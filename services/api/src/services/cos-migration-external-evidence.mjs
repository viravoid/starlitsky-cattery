import crypto from "node:crypto";

const HASH = /^[a-f0-9]{64}$/;
const SOURCE_SUCCESS = new Set([
  "current-exists-complete-read-trusted-hash-match",
  "current-exists-complete-read-no-trusted-historical-hash",
]);
const COPY_SUCCESS = new Set(["copied-and-verified", "verified-existing"]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function requireEvidence(ok, message) {
  if (!ok) throw new Error(`External COS copy evidence rejected: ${message}`);
}

export function calculateExternalEvidenceIndexSha256(index) {
  const core = { ...index };
  delete core.indexSha256;
  return sha256(JSON.stringify(stable(core)));
}

export function verifyExternalCosCopyEvidence({ inventory, index, bundles, approvedIndexSha256 }) {
  requireEvidence(
    [1, 2].includes(index?.schemaVersion) && Array.isArray(index.bundles),
    "invalid index",
  );
  requireEvidence(
    HASH.test(approvedIndexSha256 ?? "") &&
      calculateExternalEvidenceIndexSha256(index) === approvedIndexSha256 &&
      index.indexSha256 === approvedIndexSha256,
    "index approval/hash mismatch",
  );
  if (index.schemaVersion === 1) {
    requireEvidence(inventory, "version 1 index requires an inventory");
    requireEvidence(
      index.inventorySha256 === inventory.inventorySha256 &&
        index.databaseSnapshotSha256 === inventory.databaseSnapshotSha256,
      "inventory or database snapshot mismatch",
    );
  } else {
    requireEvidence(
      !Object.hasOwn(index, "inventorySha256") && !Object.hasOwn(index, "databaseSnapshotSha256"),
      "version 2 evidence index must not claim a database snapshot",
    );
  }
  if (inventory) {
    requireEvidence(
      index.sourceBucket === inventory.sourceBucket &&
        index.targetBucket === inventory.targetBucket,
      "bucket mismatch",
    );
    requireEvidence(Array.isArray(inventory.targetObjects), "target HEAD inventory is missing");
  }
  requireEvidence(
    bundles?.length === index.bundles.length && bundles.length > 0,
    "missing evidence bundle",
  );
  const expected = inventory
    ? new Map((inventory.sourceObjects ?? []).map((item) => [item.objectKey, item]))
    : null;
  const targetObjects = inventory
    ? new Map(inventory.targetObjects.map((item) => [item.objectKey, item]))
    : null;
  if (inventory) {
    requireEvidence(
      expected.size === inventory.sourceObjects.length &&
        targetObjects.size === inventory.targetObjects.length,
      "duplicate source or target inventory key",
    );
  }
  const verified = new Map();
  const bundleIds = new Set();
  for (let n = 0; n < bundles.length; n += 1) {
    const {
      sourceReport: source,
      sourceEvidenceIndex,
      copyManifest: manifest,
      copyPlan: plan,
      copyJournal: journal,
    } = bundles[n];
    const pins = index.bundles[n];
    requireEvidence(
      pins?.id && Object.keys(pins.artifacts ?? {}).length === 5,
      "incomplete artifact pins",
    );
    requireEvidence(!bundleIds.has(pins.id), "duplicate bundle id");
    bundleIds.add(pins.id);
    for (const [name, value] of Object.entries({
      sourceReport: source,
      sourceEvidenceIndex,
      copyManifest: manifest,
      copyPlan: plan,
      copyJournal: journal,
    })) {
      requireEvidence(
        HASH.test(pins.artifacts[name]?.canonicalSha256 ?? "") &&
          sha256(JSON.stringify(value)) === pins.artifacts[name].canonicalSha256,
        `${pins.id}: ${name} digest mismatch`,
      );
    }
    requireEvidence(
      source?.status === "completed" &&
        !source.stopReason &&
        source.sourceBucket === index.sourceBucket,
      `${pins.id}: source report incomplete`,
    );
    requireEvidence(
      sourceEvidenceIndex?.reportStatus === "completed" &&
        sourceEvidenceIndex.reportSha256 === sha256(JSON.stringify(source)) &&
        sourceEvidenceIndex.candidateKeysetSha256 === source.candidateKeysetSha256,
      `${pins.id}: source index mismatch`,
    );
    requireEvidence(
      manifest?.sourceBucket === index.sourceBucket &&
        manifest.targetBucket === index.targetBucket &&
        manifest.sourceReportCanonicalSha256 === sha256(JSON.stringify(source)) &&
        manifest.candidateKeysetSha256 === source.candidateKeysetSha256,
      `${pins.id}: manifest scope mismatch`,
    );
    requireEvidence(
      Array.isArray(manifest.objects) &&
        manifest.objects.length > 0 &&
        Array.isArray(source.results) &&
        source.results.length === manifest.objects.length,
      `${pins.id}: source result count mismatch`,
    );
    const manifestCore = { ...manifest };
    delete manifestCore.copyManifestSha256;
    requireEvidence(
      sha256(JSON.stringify(stable(manifestCore))) === manifest.copyManifestSha256,
      `${pins.id}: manifest integrity mismatch`,
    );
    const planCore = { ...plan };
    delete planCore.planSha256;
    requireEvidence(
      sha256(JSON.stringify(stable(planCore))) === plan.planSha256 &&
        plan.copyManifestSha256 === manifest.copyManifestSha256 &&
        plan.sourceEvidence?.reportCanonicalSha256 === sha256(JSON.stringify(source)),
      `${pins.id}: copy plan mismatch`,
    );
    requireEvidence(
      journal?.planSha256 === plan.planSha256 &&
        journal.targetPolicySetSha256 === plan.targetPolicySetSha256 &&
        /^completed-\d+-byte-verified$/.test(journal.status ?? ""),
      `${pins.id}: journal incomplete or detached`,
    );
    requireEvidence(
      journal.status === `completed-${manifest.objects.length}-byte-verified` &&
        plan.scope?.objectCount === manifest.objects.length &&
        plan.scope?.sourceBucket === index.sourceBucket &&
        plan.scope?.targetBucket === index.targetBucket,
      `${pins.id}: copy scope/count mismatch`,
    );
    requireEvidence(
      plan.execution?.automaticNetworkRetries === 0 &&
        plan.execution?.stopOnAnyNonSuccessStatus === true &&
        plan.execution?.preserveConflictingTarget === true &&
        plan.execution?.deleteSource === false &&
        plan.execution?.modifyDatabase === false &&
        plan.execution?.switchUrls === false,
      `${pins.id}: unsafe execution controls`,
    );
    requireEvidence(
      Object.keys(journal.objects ?? {}).length === manifest.objects.length,
      `${pins.id}: journal object count mismatch`,
    );
    requireEvidence(
      source.summary?.processed === manifest.objects.length &&
        source.summary?.unprocessed === 0 &&
        source.requests?.head === manifest.objects.length &&
        source.requests?.get === manifest.objects.length &&
        source.requests?.total === 2 * manifest.objects.length,
      `${pins.id}: source request accounting incomplete`,
    );
    requireEvidence(
      Array.isArray(source.requestLedger) &&
        source.requestLedger.length === source.requests.total &&
        source.transport?.actualHttpRequests === source.requests.total &&
        source.transport?.blockedRetryAttempts === 0,
      `${pins.id}: source transport ledger incomplete`,
    );
    requireEvidence(
      sourceEvidenceIndex.bytesRead === source.bytesRead &&
        sourceEvidenceIndex.requestCounts?.total === source.requests.total,
      `${pins.id}: source index accounting mismatch`,
    );
    const sourceByKey = new Map();
    for (const item of source.results) {
      requireEvidence(!sourceByKey.has(item.objectKey), `${pins.id}: duplicate source result`);
      sourceByKey.set(item.objectKey, item);
    }
    let bytes = 0;
    const totals = {
      sourceGet: 0,
      targetHead: 0,
      targetGet: 0,
      targetPut: 0,
      downloadBytes: 0,
      uploadBytes: 0,
    };
    for (const object of manifest.objects) {
      const key = object.objectKey;
      const item = sourceByKey.get(key);
      const copy = journal.objects[key];
      const result = copy?.result;
      const inventoryObject = expected?.get(key);
      const targetObject = targetObjects?.get(key);
      requireEvidence(!verified.has(key), `${pins.id}: duplicate key across bundles`);
      if (inventory) {
        requireEvidence(inventoryObject, `${pins.id}: out-of-inventory key`);
      }
      requireEvidence(
        sha256(key) === object.objectKeySha256 &&
          item?.objectKeySha256 === object.objectKeySha256 &&
          copy?.objectKeySha256 === object.objectKeySha256,
        `${pins.id}: key digest mismatch`,
      );
      requireEvidence(
        HASH.test(object.sha256 ?? "") &&
          Number.isSafeInteger(object.sizeBytes) &&
          object.sizeBytes > 0,
        `${pins.id}: invalid object metadata`,
      );
      if (inventory) {
        requireEvidence(
          inventoryObject.sizeBytes === object.sizeBytes &&
            (!inventoryObject.contentType ||
              inventoryObject.contentType.split(";")[0].toLowerCase() === object.mimeType),
          `${pins.id}: inventory metadata mismatch`,
        );
        requireEvidence(
          targetObject?.sizeBytes === object.sizeBytes &&
            targetObject.inventoryConsistency === "head-confirmed" &&
            (!targetObject.contentType ||
              targetObject.contentType.split(";")[0].toLowerCase() === object.mimeType),
          `${pins.id}: target HEAD inventory mismatch`,
        );
      }
      for (const record of inventory?.records ?? []) {
        if (record.objectKey !== key) continue;
        requireEvidence(
          record.sizeBytes === object.sizeBytes &&
            (!record.checksum ||
              record.checksum.replace(/^sha256:/, "").toLowerCase() === object.sha256),
          `${pins.id}: database media metadata mismatch`,
        );
      }
      requireEvidence(
        SOURCE_SUCCESS.has(item?.status) &&
          item.expectedSizeBytes === object.sizeBytes &&
          item.head?.exists === true &&
          item.head.contentLength === object.sizeBytes &&
          item.get?.exists === true &&
          item.get.bytesRead === object.sizeBytes &&
          item.get.sha256 === object.sha256,
        `${pins.id}: source bytes unverified`,
      );
      const sourceRequests = source.requestLedger.filter(
        (request) => request.objectKeySha256 === object.objectKeySha256,
      );
      requireEvidence(
        sourceRequests.length === 2 &&
          sourceRequests.some(
            (request) =>
              request.method === "HEAD" &&
              request.status === "completed" &&
              request.statusCode === 200,
          ) &&
          sourceRequests.some(
            (request) =>
              request.method === "GET" &&
              request.status === "completed" &&
              [200, 206].includes(request.statusCode) &&
              request.bytesRead === object.sizeBytes,
          ),
        `${pins.id}: source object request ledger incomplete`,
      );
      requireEvidence(
        item.expectedSha256 === object.sha256 ||
          item.status === "current-exists-complete-read-no-trusted-historical-hash",
        `${pins.id}: source expected hash mismatch`,
      );
      requireEvidence(
        copy?.status === "verified" &&
          copy.attempts === 1 &&
          COPY_SUCCESS.has(result?.status) &&
          result.objectKey === key &&
          result.sizeBytes === object.sizeBytes &&
          result.mimeType === object.mimeType,
        `${pins.id}: copy status mismatch`,
      );
      requireEvidence(
        result.sourceVerification?.ok === true &&
          result.sourceContentSha256 === object.sha256 &&
          result.byteVerification?.algorithm === "sha256" &&
          result.byteVerification?.status === "match" &&
          result.byteVerification.actual === object.sha256 &&
          result.byteVerification.expected === object.sha256,
        `${pins.id}: target bytes unverified`,
      );
      requireEvidence(
        result.checksumVerification?.status !== "mismatch" &&
          copy.counters?.sourceGet === 1 &&
          copy.counters?.targetGet === 1 &&
          copy.counters?.targetHead >= 1 &&
          copy.counters?.targetHead <= 2 &&
          copy.counters?.targetPut <= 1,
        `${pins.id}: copy request evidence mismatch`,
      );
      requireEvidence(
        copy.counters.targetPut === (result.status === "copied-and-verified" ? 1 : 0) &&
          copy.counters.targetHead === (result.status === "copied-and-verified" ? 2 : 1),
        `${pins.id}: copy operation counters contradict status`,
      );
      requireEvidence(
        copy.counters.downloadBytes === object.sizeBytes * 2 &&
          copy.counters.uploadBytes === object.sizeBytes * copy.counters.targetPut,
        `${pins.id}: copy traffic evidence mismatch`,
      );
      for (const name of Object.keys(totals)) totals[name] += copy.counters[name];
      bytes += object.sizeBytes;
      verified.set(key, {
        objectKey: key,
        sizeBytes: object.sizeBytes,
        sha256: object.sha256,
        sourceBundleId: pins.id,
        status: result.status,
      });
    }
    requireEvidence(
      bytes === source.bytesRead &&
        bytes === plan.scope.totalBytes &&
        sourceByKey.size === manifest.objects.length,
      `${pins.id}: source byte total mismatch`,
    );
    requireEvidence(
      Object.keys(totals).every((name) => journal.actualRequests?.[name] === totals[name]),
      `${pins.id}: journal request totals mismatch`,
    );
    requireEvidence(
      Object.keys(journal.objects).every((key) => sourceByKey.has(key)),
      `${pins.id}: journal contains unexpected key`,
    );
  }
  return {
    verifiedKeys: [...verified.keys()].sort(),
    provenance: [...verified.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey)),
    approvedIndexSha256,
  };
}
