# Public Content Import Source Fidelity Audit

Source attachment: `置顶全文（图片素材在文件夹）(1).docx`

This batch imports only text and structured public content supported by the attachment and current product models. It does not extract images, create media records, create kitten records, invent contract terms, or add a general article/CMS destination.

## Imported Fixed Pages

| Source heading | Target slug | Schema version | Transformation |
| --- | --- | --- | --- |
| 一，猫舍介绍 / 关于我们 | `about` | 1 | Original paragraphs preserved in `body`; directly supported facts split into existing `facts` keys. |
| 二，繁育理念 | `philosophy` | 1 | Original paragraphs preserved in `body`; first paragraph also mapped to `openingBelief` for the current fixed-page template. |
| 三，猫舍环境 | `environment` | 1 | Intro preserved in `body`; named zones split into `sections`; directly stated area/planning facts split into `facts`. |
| 四，猫舍喂养 | `feeding` | 1 | Intro preserved in `body`; food categories split into `sections`; directly stated feeding facts split into `facts`. |
| 五，定价，购买流程 | `process` | 1 | Intro preserved in `body`; price/process groups split into `sections`; directly stated process facts split into `facts`. |
| 六，联系方式 | `contact` | 1 | Public accounts mapped into `accounts`; UI helper copy is intentionally not stored in the source-derived manifest. |
| 七，售后保障 | `aftercare` | 1 | Original warranty text preserved in `body`; pre-home checklist split into a section; contract reference preserved as a source reference, not expanded. |

All imported fixed pages default to `draft`.

## Imported Breeding Cats

Each cat maps to `Cat` plus `BreedingCatProfile`. The stable import identity is the deterministic `Cat.id` plus `storyJson.source.publicContentImportId`. New cats default to `visibility=hidden` because images are deferred.

| Source group | Name | Color | Mapped target fields |
| --- | --- | --- | --- |
| 现役公猫 | 重楼 | 红虎斑（d22） | `Cat.name`, `gender=male`, `color`, `lifecycle_status=breeding`, `visibility=hidden`, `story_json.story`; `BreedingCatProfile.breeding_role=king`, `reproductive_state=semiRetired`, `status_label=半退役`. |
| 现役公猫 | 琥珀 | 棕虎斑麻纹加白（n2509） | `Cat.name`, `gender=male`, `color`, `lifecycle_status=breeding`, `visibility=hidden`, `story_json.story`; `BreedingCatProfile.breeding_role=king`, `reproductive_state=active`, `status_label=现役公猫`. |
| 现役公猫 | 水龙吟 | 黑银鱼骨纹（高银）（ns23） | Same Cat fields; `BreedingCatProfile.breeding_role=king`, `reproductive_state=active`, `status_label=现役公猫`. |
| 现役公猫 | 天河 | 银虎斑加白（ns2203） | Same Cat fields; `BreedingCatProfile.breeding_role=king`, `reproductive_state=active`, `status_label=现役公猫`. |
| 预备役公猫 | 三明治 | 棕虎斑（n22） | Same Cat fields; `BreedingCatProfile.breeding_role=candidate`, `reproductive_state=observing`, `status_label=预备役公猫`. |
| 现役母猫 | 云母 | 黑银麻纹加白（ns2503） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |
| 现役母猫 | 尿团 | 银玳瑁虎斑（fs22） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |
| 现役母猫 | 桂花糕 | 玳瑁麻纹加白（f2509） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |
| 现役母猫 | 昭月 | 黑银鱼骨纹（ns23） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |
| 现役母猫 | 惊蛰 | 蓝银虎斑（as22） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |
| 现役母猫 | 小熊猫 | 棕麻纹加白（n2509） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |
| 现役母猫 | 云玥 | 银玳瑁虎斑（fs22） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |
| 现役母猫 | 小虾线 | 银玳瑁麻纹（fs25） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |
| 现役母猫 | 玛瑙 | 玳瑁虎斑加白（f2209） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |
| 现役母猫 | 小边牧 | 玳瑁虎斑（f22） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |
| 现役母猫 | 小桃 | 玳瑁麻纹（f25） | Same Cat fields; `BreedingCatProfile.breeding_role=queen`, `reproductive_state=active`, `status_label=现役母猫`. |

The manifest intentionally does not fill `birthday`, `personality`, `BreedingCatProfile.trait`, `BreedingCatProfile.source`, `health_summary`, media fields, owner links, litter links, or kitten profiles.

## Source-Derived Data

- Fixed-page `body`, `sections`, `accounts`, and listed `facts` are derived from the corresponding source heading only.
- `about.facts.aftercare` was removed because the "猫舍介绍 / 关于我们" source paragraphs do not directly state aftercare or long-term companion support; those ideas appear in later sections and must not be re-labeled as direct about-page facts.
- Breeding cat names, colors, group labels, and story paragraphs are copied from the "种猫介绍" source text without adding unsupported business facts.
- Breeding profile role/state/status fields are structural mappings from the source groups and current product vocabulary; free-text `trait` and `source` are not manifest-owned because the attachment does not provide reliable structured values for them.

## Existing UI Fallback / Helper Text

- Contact helper copy such as "点击即可复制账号，欢迎来聊聊猫、看看小猫日常。" remains in existing frontend fallback/normalization code.
- That helper copy is product UI text, not DOCX source text, so the manifest no longer stores it as `contentJson.introduction`.
- Empty or omitted helper fields should be filled by the fixed-page UI fallback layer when appropriate.

## Structural Mapping

- Fixed-page `content_json` is treated as source-owned only for top-level keys present in the manifest. Existing top-level extension keys are preserved; source-owned arrays such as `sections` are replaced as complete arrays instead of index-merged.
- Fixed-page top-level DB fields are updated only when manifest ownership is explicit. Omitted `seoTitle` and `seoDescription` do not update or clear existing `seo_title` and `seo_description`.
- `Cat.story_json` is not owned as a whole object. The importer updates `story` and known provenance keys under `source`, while preserving unrelated existing top-level keys and unrelated nested `source` keys.
- `MediaAsset` and `MediaBinding` are independent storage/binding records and are not created, updated, or deleted by this importer.

## Skipped / Unmapped

| Source heading | Reason | Detail |
| --- | --- | --- |
| 九，我们繁育的小猫 | Source insufficient | The source does not provide per-cat kitten records, litter identity, parents, prices, sale state, or enough data to create safe kitten `Cat` rows. |
| 单独一篇环境大图介绍 | Current product has no destination | The source describes standalone material for environment inquiries. Current product structure has fixed pages, not a general article entry. |
| 售后内容见附件,《合同模板2026》 | Contract attachment missing | The contract itself was not provided in this batch, so no contract content or terms are generated. |
| 图片素材 | Image deferred | Images are out of scope. No local files are committed, no DOCX images are extracted, no COS upload occurs, and no `MediaAsset`/`MediaBinding` rows are created. |

## Safety Summary

- Import command defaults to dry-run and requires `--apply` to mutate.
- `DATABASE_URL` must be explicit and must be SQLite `file:`.
- Production-like targets require `--confirm-production`.
- The importer never deletes, prunes, truncates, resets, or replaces the database.
- Existing same-name cats without the manifest import identity are reported as conflicts and block apply.
- Only manifest-owned fields are updated; omitted fields are left intact.
