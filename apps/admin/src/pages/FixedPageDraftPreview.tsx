import type { FixedPageData, FixedPageMediaAssetData, MediaAssetData } from "@starlitsky/shared";
import type { ReactNode } from "react";
import {
  normalizeFixedPageView,
  type FixedPageViewData,
  type PageImage,
} from "../../../miniapp/utils/fixed-page-content";
import {
  normalizeQuestionnaireContent,
  type QuestionnaireTextQuestion,
  type QuestionnaireChoiceQuestion,
} from "../../../miniapp/utils/questionnaire-content";
import { QUESTION_GROUPS } from "./QuestionnaireContentEditor";

type Content = Record<string, unknown>;

export function FixedPageDraftPreview({
  content,
  images,
  page,
  title,
  onClose,
}: {
  content: Content;
  images: MediaAssetData[] | null;
  page: FixedPageData;
  title: string;
  onClose: () => void;
}) {
  const media = previewMedia(page, images);
  const view = normalizeFixedPageView(page.slug, title, content, media);

  return (
    <section aria-label="未保存内容预览" className="fixed-draft-preview">
      <div className="fixed-draft-preview-head">
        <div>
          <strong>未保存内容预览</strong>
          <p>
            显示点击预览时的草稿；继续编辑后可再次预览。关闭后内容仍保留，页面操作和提交在预览中不可用。
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={onClose}>
          返回编辑
        </button>
      </div>
      {page.slug === "breeding-plan" ? (
        <p className="fixed-draft-preview-note">
          种猫资料由小程序实时读取；此处展示草稿中的计划与配对编号。
        </p>
      ) : null}
      <div className="fixed-draft-preview-phone">
        {page.slug === "home" ? (
          <HomePreview content={content} media={media} title={title} />
        ) : page.slug === "questionnaire" ? (
          <QuestionnairePreview content={content} />
        ) : (
          <FixedPagePreview view={view} />
        )}
      </div>
    </section>
  );
}

function previewMedia(
  page: FixedPageData,
  images: MediaAssetData[] | null,
): FixedPageMediaAssetData[] {
  if (!images) return page.mediaAssets;
  const current = images.flatMap((image) =>
    image.bindings
      .filter(
        (binding) =>
          binding.ownerType === "fixed_page" &&
          binding.ownerId === page.id &&
          binding.visibility === "visible" &&
          !binding.deletedAt,
      )
      .map((binding) => ({
        id: image.id,
        kind: image.kind,
        sourceUrl: image.sourceUrl,
        thumbnailUrl: image.thumbnailUrl,
        title: image.title,
        altText: image.altText,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        width: image.width,
        height: image.height,
        usage: binding.usage,
        sortOrder: binding.sortOrder,
      })),
  );
  return current;
}

function FixedPagePreview({ view }: { view: FixedPageViewData }) {
  return (
    <div className="fixed-draft-preview-content">
      {view.viewKind === "about" ? (
        <>
          <Heading title="猫舍名片" subtitle="At a glance" />
          <div className="fixed-draft-preview-grid">
            {view.aboutFacts.map((item) => (
              <Card key={item.id}>{item.text}</Card>
            ))}
          </div>
          <Card>
            <h4>{view.aboutOwnerTitle}</h4>
            <p>{view.aboutOwnerBody}</p>
          </Card>
          <Heading title="About StarlitSky" />
          {view.aboutBodyParagraphs.map((item) => (
            <p key={item.id}>{item.text}</p>
          ))}
        </>
      ) : null}
      {view.viewKind === "philosophy"
        ? view.philosophyParagraphs.map((item) => <p key={item.id}>{item.text}</p>)
        : null}
      {view.viewKind === "environment" ? (
        <>
          <Heading title="Environment" />
          <Card>
            <p>{view.environmentIntro}</p>
            <Pills items={view.environmentTags.map((item) => item.text)} />
          </Card>
          {view.environmentSections.map((section) => (
            <Card key={section.id}>
              <h4>{section.title}</h4>
              <Pills
                items={[
                  `${section.roomCount} 个房间 / 子区域`,
                  `${section.photoCount} 张照片`,
                  section.meta,
                ].filter(Boolean)}
              />
              <p>{section.summary}</p>
              {section.rooms.map((room) => (
                <div className="fixed-draft-preview-subsection" key={room.id}>
                  <h5>{room.title}</h5>
                  <p>{room.description}</p>
                  <ImageRow images={room.images} />
                </div>
              ))}
            </Card>
          ))}
        </>
      ) : null}
      {view.viewKind === "feeding" ? (
        <>
          <Heading title="Feeding" />
          <p>{view.feedingIntro}</p>
          {view.feedingModules.map((module) => (
            <Card key={module.id}>
              <small>{module.no}</small>
              <h4>{module.title}</h4>
              <p>{module.body}</p>
              <ImageRow
                images={module.images
                  .map((slot) => slot.image)
                  .filter((image): image is PageImage => image !== null)}
              />
            </Card>
          ))}
        </>
      ) : null}
      {view.viewKind === "process" ? (
        <>
          <Heading title="价格区间" subtitle="Pricing" />
          <p>{view.pricingIntro}</p>
          {view.priceCards.map((item) => (
            <Card key={item.id}>
              <h4>
                {item.label} · {item.value}
              </h4>
              <p>{item.note}</p>
            </Card>
          ))}
          <Heading title="繁育权" />
          <p>{view.processBreedingIntro}</p>
          {view.processBreedingCards.map((item) => (
            <Card key={item.id}>
              {item.label} · {item.value}
            </Card>
          ))}
          <Heading title="老家长福利" />
          <p>{view.processReturningIntro}</p>
          {view.processReturningBenefits.map((item) => (
            <Card key={item.id}>
              {item.label} · {item.value}
            </Card>
          ))}
          <Heading title="购买流程" />
          {view.processSteps.map((item) => (
            <Card key={item.id}>
              <h4>
                {item.no}. {item.title}
              </h4>
              <p>{item.description}</p>
            </Card>
          ))}
          <Heading title="新家礼包" />
          <Pills items={view.welcomeKitItems.map((item) => item.text)} />
          <p>{view.welcomeKitNote}</p>
          <p>{view.processContractNotice}</p>
        </>
      ) : null}
      {view.viewKind === "aftercare" ? (
        <>
          <Heading title="繁育与售后承诺" />
          {view.aftercarePromises.map((item) => (
            <Card key={item.id}>{item.text}</Card>
          ))}
          <Heading title="去新家前项目" />
          <Card>
            {view.aftercareHealthItems.map((item) => (
              <p key={item.id}>• {item.text}</p>
            ))}
          </Card>
          <Heading title="合同文件" />
          <Card>
            <h4>{view.aftercareContractTitle}</h4>
            <p>{view.aftercareContractFileName || "当前还没有上传合同文件"}</p>
          </Card>
          <p>{view.processContractNotice}</p>
        </>
      ) : null}
      {view.viewKind === "contact" ? (
        <>
          <Heading title="在这些地方找到星月" />
          <p>{view.contactIntroduction}</p>
          {view.accounts.map((item) => (
            <Card key={item.id}>
              {item.label}: {item.value}
            </Card>
          ))}
          <Card>{view.contactFooterNotice}</Card>
        </>
      ) : null}
      {view.viewKind === "breeding-plan" ? (
        <>
          <Heading title="Breeding Plan" />
          <h4>{view.breedingPeriod}</h4>
          <p>{view.breedingIntroduction}</p>
          {view.breedingGroups.map((group) => (
            <section key={group.id}>
              <Heading title={group.title} subtitle={group.eyebrow} />
              <p>{group.description}</p>
              {group.pairings.map((pairing) => (
                <Card key={pairing.id}>
                  <p>{pairing.timeLabel}</p>
                  <h4>
                    {pairing.male?.name || pairing.maleFallbackId || "公猫待补充"} ×{" "}
                    {pairing.female?.name || pairing.femaleFallbackId || "母猫待补充"}
                  </h4>
                  <Pills items={pairing.colors.map((item) => item.text)} />
                  <p>{pairing.colorNote}</p>
                </Card>
              ))}
            </section>
          ))}
          <p>{view.colorDisclaimer}</p>
          <p>{view.scheduleDisclaimer}</p>
        </>
      ) : null}
      {view.viewKind === "generic" ? (
        <>
          <Heading title={view.title} subtitle="StarlitSky" />
          {view.coverImage ? (
            <img
              className="fixed-draft-preview-image"
              src={view.coverImage.url}
              alt={view.coverImage.altText}
            />
          ) : null}
          <p>{view.body}</p>
          {view.genericSections.map((section) => (
            <Card key={section.id}>
              <h4>{section.title}</h4>
              <p>{section.body}</p>
            </Card>
          ))}
        </>
      ) : null}
    </div>
  );
}

function HomePreview({
  content,
  media,
  title,
}: {
  content: Content;
  media: FixedPageMediaAssetData[];
  title: string;
}) {
  const hero = record(content.hero),
    intro = record(content.intro),
    cats = record(content.catsPreview);
  const groups = array(content.groups),
    entries = record(content.entries);
  return (
    <div className="fixed-draft-preview-content">
      <Heading title={str(hero.title) || title} subtitle={str(hero.subtitle)} />
      <ImageRow
        images={array(hero.slides)
          .map((raw) => {
            const slide = record(raw),
              image = media.find((item) => item.id === slide.imageId);
            return image
              ? {
                  id: image.id,
                  url: image.sourceUrl,
                  altText: str(slide.label),
                  title: str(slide.label),
                }
              : null;
          })
          .filter((image): image is PageImage => image !== null)}
      />
      <Heading title={str(intro.eyebrowPrefix)} subtitle={str(intro.fixedMeta)} />
      <p>{str(intro.body)}</p>
      {groups.map((raw, index) => {
        const group = record(raw);
        return (
          <section key={str(group.id) || index}>
            <Heading title={str(group.cn)} subtitle={str(group.en)} />
            <p>{str(group.lead)}</p>
            {array(group.entryOrder).map((id) => (
              <Card key={String(id)}>
                <h4>{str(record(entries[String(id)]).title)}</h4>
                <p>{str(record(entries[String(id)]).desc)}</p>
              </Card>
            ))}
          </section>
        );
      })}
      <Heading title={str(cats.title)} subtitle={str(cats.eyebrow)} />
      <p>{str(cats.description)}</p>
      <p>{str(cats.buttonText)}</p>
    </div>
  );
}

function QuestionnairePreview({ content }: { content: Content }) {
  const questionnaire = normalizeQuestionnaireContent(content);
  return (
    <div className="fixed-draft-preview-content">
      <Heading title="选猫问卷" />
      <Card>
        <p>{questionnaire.intro}</p>
        <p>{questionnaire.privacyNotice}</p>
      </Card>
      {QUESTION_GROUPS.map((group) => {
        const questions: Record<string, QuestionnaireTextQuestion | QuestionnaireChoiceQuestion> =
          questionnaire[group.key];
        return (
          <section key={group.key}>
            <Heading title={group.title} />
            {group.questions.map(([key]) => {
              const question = questions[key];
              return (
                <Card key={key}>
                  <h4>{question.label}</h4>
                  {"options" in question ? (
                    <Pills items={question.options.map((option) => option.label)} />
                  ) : (
                    <p className="fixed-draft-preview-placeholder">
                      {question.placeholder || "请输入"}
                    </p>
                  )}
                </Card>
              );
            })}
          </section>
        );
      })}
      <Heading title="五、饲养理念与承诺" />
      {[
        questionnaire.commitments.scientificFeeding,
        questionnaire.commitments.acceptActive,
        questionnaire.commitments.commitment,
      ].map((label, index) => (
        <Card key={index}>
          <h4>{label}</h4>
          <Pills items={questionnaire.commitments.options.map((option) => option.label)} />
        </Card>
      ))}
      <p>{questionnaire.ps}</p>
      <Heading title="提交成功页" />
      <Card>
        <h4>{questionnaire.successTitle}</h4>
        <p>{questionnaire.successBody}</p>
      </Card>
      <p className="fixed-draft-preview-note">
        预览中的输入和提交已禁用；实际问卷提交仍由小程序处理。
      </p>
    </div>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="fixed-draft-preview-heading">
      <h3>{title}</h3>
      {subtitle ? <small>{subtitle}</small> : null}
    </div>
  );
}
function Card({ children }: { children: ReactNode }) {
  return <div className="fixed-draft-preview-card">{children}</div>;
}
function Pills({ items }: { items: string[] }) {
  return (
    <div className="fixed-draft-preview-pills">
      {items.map((item, index) => (
        <span key={`${item}-${index}`}>{item}</span>
      ))}
    </div>
  );
}
function ImageRow({ images }: { images: PageImage[] }) {
  return images.length ? (
    <div className="fixed-draft-preview-images">
      {images.map((image) => (
        <img key={image.id} src={image.url} alt={image.altText || image.title} />
      ))}
    </div>
  ) : null;
}
function record(value: unknown): Content {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Content) : {};
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
