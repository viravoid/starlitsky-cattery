import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder } from "@/components/mobile/ui";

export const Route = createFileRoute("/philosophy")({
  component: Philosophy,
});

function ChapterHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-5">
      <div className="font-display text-[26px] leading-none tracking-widest text-[#d9b26a]">
        {index}
      </div>
      <h3 className="mt-2 text-[17px] font-semibold tracking-[0.05em] text-heading">
        {title}
      </h3>
      <div className="mt-3 h-px w-8 bg-[#d9b26a]/60" />
    </div>
  );
}

function Divider() {
  return (
    <div className="my-10 flex items-center justify-center gap-2 opacity-60">
      <span className="h-px w-10 bg-[#d9b26a]/50" />
      <span className="h-1 w-1 rounded-full bg-[#d9b26a]/70" />
      <span className="h-px w-10 bg-[#d9b26a]/50" />
    </div>
  );
}

// Prose paragraph — reused for consistent typography.
function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-[1.9] text-[#5b4a3a]">{children}</p>
  );
}

function Philosophy() {
  return (
    <PhoneFrame title="繁育理念" backTo="/">
      {/* Title */}
      <Section className="pb-2 pt-2 text-center">
        <h2 className="font-display text-[24px] tracking-[0.08em] text-heading">
          繁育理念
        </h2>
        <p className="mt-2 font-display text-[10px] uppercase tracking-[0.4em] text-[#8aa8c8]">
          Breeding Philosophy
        </p>
      </Section>

      {/* Intro */}
      <Section className="mt-6">
        <div className="rounded-2xl border border-[#efe4cf] bg-[#fbf5e8]/60 px-5 py-6">
          <P>
            我们的繁育理念是繁育体质好、抵抗力强，乖巧亲人、大方自信的小猫。从小猫出生开始记录到去新家，让家长不会缺席小猫成长的每一个阶段。
          </P>
          <p className="mt-4 text-center font-display text-[16px] tracking-[0.15em] text-heading">
            做一家有温度的猫舍
          </p>
        </div>
      </Section>

      <Section>
        <Divider />
      </Section>

      {/* 01 */}
      <Section>
        <ChapterHeading index="01" title="这些年的努力" />
        <div className="space-y-4">
          <P>
            这些年我们一直在不断努力，投入更多的精力陪伴小猫，从小进行社会化并记录日常，把主粮从 Halo 换成 NG 和百利高。
          </P>
          <P>
            这一切的努力都是有回报的。在小猫日常记录群，我们也认识了很多新朋友，得到了很多家长的支持与信任，也繁育出了很多很满意的小猫。
          </P>
          <P>
            今年也会有更多自留和新引进的宝宝加入我们的繁育计划。
          </P>
        </div>
        <div className="mt-6">
          <Placeholder
            label="示例图片（小猫日常陪伴 / 社会化记录照片）"
            ratio="aspect-[4/3]"
          />
        </div>
      </Section>

      <Section>
        <Divider />
      </Section>

      {/* 02 */}
      <Section>
        <ChapterHeading index="02" title="一个新的阶段" />
        <div className="space-y-4">
          <P>
            今年是我做繁育的第五年，月七做繁育的第七年。
          </P>
          <P>
            我们终于搬进了和小猫共同的新家，我们的人生和猫舍也都迈向了一个新的阶段。
          </P>
        </div>
        <p className="mt-8 text-center font-display text-[15px] leading-[1.9] tracking-[0.05em] text-heading">
          从一开始的迷茫从众，<br />到现在有了清晰的目标。
        </p>
        <div className="mt-6">
          <Placeholder
            label="示例图片(猫舍新家 / 主理人与小猫共同生活照片)"
            ratio="aspect-[4/3]"
          />
        </div>
      </Section>

      <Section>
        <Divider />
      </Section>

      {/* 03 */}
      <Section>
        <ChapterHeading index="03" title="我们理解的缅因与风格" />
        <div className="mb-6">
          <Placeholder
            label="示例图片(代表猫舍繁育风格的种猫照片)"
            ratio="aspect-[3/4]"
          />
        </div>
        <div className="space-y-4">
          <P>
            如今我们对缅因猫的血线也有了比较深入的了解，意识到血线与风格的复杂与多样，不再拘泥于「纯美血」「纯欧血」这种划分。
          </P>
          <P>
            因为缅因从不只有这两种风格。甜美小体、大体、大刷子、毛怪，都代表不了全部的缅因猫。
          </P>
          <P>
            在世界各地都有出色的缅因繁育人，很多繁育人的小猫都有着自己独特又有魅力的风格。
          </P>
          <P>
            我们追求的，就是在符合品标的前提下，做好健康筛查，繁育出健康亲人、表情精致甜酷、体格较大、毛量优秀，并有自己独特风格的小猫。
          </P>
        </div>
      </Section>

      <Section>
        <Divider />
      </Section>

      {/* 04 */}
      <Section>
        <ChapterHeading index="04" title="我们想坚持一生的事业" />
        <div className="space-y-4">
          <P>
            经过多年深耕，我们的生活早已和猫舍深度绑定，很多家长也都成为了我们的朋友。
          </P>
          <P>
            猫舍早已不只是我们的兴趣爱好，而是我们想要坚持一生的事业。每只小猫都是我们家中的一份子。
          </P>
          <P>
            我们希望以后也能遇到更多三观相符、科养爱猫的小猫家长，互相尊重、互相选择、互相信任，一起把每一只小猫照顾好。
          </P>
          <P>
            有任何问题，我们都绝不推诿，认真做好售后，让每个宝宝都能健康长大，和新家长开心生活。
          </P>
        </div>

        <div className="mt-10 flex items-center justify-center gap-3 font-display text-[13px] tracking-[0.2em] text-heading">
          <span>互相尊重</span>
          <span className="h-1 w-1 rounded-full bg-[#d9b26a]/70" />
          <span>互相选择</span>
          <span className="h-1 w-1 rounded-full bg-[#d9b26a]/70" />
          <span>互相信任</span>
        </div>

        <p className="mb-10 mt-6 text-center text-[13px] leading-[1.9] text-warm">
          让每个宝宝都能健康长大，<br />和新家长开心生活。
        </p>
      </Section>
    </PhoneFrame>
  );
}
