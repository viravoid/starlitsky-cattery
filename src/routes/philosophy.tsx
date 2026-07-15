import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";

export const Route = createFileRoute("/philosophy")({
  component: Philosophy,
});

function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[15px] leading-[1.9] text-[#5b4a3a] ${className ?? ""}`}>{children}</p>
  );
}

function Philosophy() {
  return (
    <PhoneFrame title="繁育理念" backTo="/">
      {/* English label */}
      <Section className="pt-4 text-center">
        <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[#8aa8c8]">
          Breeding Philosophy
        </p>
      </Section>

      {/* Opening — lightweight card */}
      <Section className="mt-3">
        <div className="rounded-xl border border-[#e8dfd0]/80 bg-[#fbf6ec]/70 px-4 py-3.5">
          <P>
            我们的繁育理念是繁育体质好、抵抗力强，乖巧亲人、大方自信的小猫。从小猫出生开始记录到去新家，让家长不会缺席小猫成长的每一个阶段。做一家有温度的猫舍。
          </P>
        </div>
      </Section>

      {/* Continuous self-narrative */}
      <Section className="mt-8 space-y-4">
        <P>
          这些年我们一直在不断努力，投入更多的精力陪伴小猫，从小进行社会化并记录日常，把主粮从 Halo 换成 NG 和百利高。
        </P>
        <P>
          这一切的努力都是有回报的。在小猫日常记录群，我们也认识了很多新朋友，得到了很多家长的支持与信任，也繁育出了很多很满意的小猫。
        </P>
        <P>
          今年也会有更多自留和新引进的宝宝加入我们的繁育计划。
        </P>
      </Section>

      {/* Time node — 05 / 07 years */}
      <Section className="mt-10">
        <div className="flex items-baseline justify-center gap-10">
          <div className="text-center">
            <div className="font-display text-[34px] font-light leading-none tracking-[0.05em] text-[#d9b26a]/80">
              05
            </div>
            <div className="mt-1.5 font-display text-[9px] uppercase tracking-[0.3em] text-[#d9b26a]/60">
              Years
            </div>
            <div className="mt-2 text-[13px] text-[#5b4a3a]">我做繁育的第五年</div>
          </div>
          <div className="text-center">
            <div className="font-display text-[34px] font-light leading-none tracking-[0.05em] text-[#d9b26a]/80">
              07
            </div>
            <div className="mt-1.5 font-display text-[9px] uppercase tracking-[0.3em] text-[#d9b26a]/60">
              Years
            </div>
            <div className="mt-2 text-[13px] text-[#5b4a3a]">月七做繁育的第七年</div>
          </div>
        </div>
      </Section>

      {/* Stage change narrative */}
      <Section className="mt-8 space-y-4">
        <P>
          我们终于搬进了和小猫共同的新家，我们的人生和猫舍也都迈向了一个新的阶段。
        </P>
        <P className="font-medium tracking-[0.02em] text-[#5b4a3a]">
          从一开始的迷茫从众，到现在有了清晰的目标。
        </P>
      </Section>

      {/* Theme transition */}
      <Section className="mt-12 text-center">
        <p className="font-display text-[9px] uppercase tracking-[0.35em] text-[#8aa8c8]/80">
          Bloodline · Style · Breeding
        </p>
        <h3 className="mt-2 text-[21px] font-semibold tracking-[0.04em] text-[#5b4a3a]">
          我们理解的缅因与风格
        </h3>
        <div className="mx-auto mt-4 h-px w-12 bg-[#d9b26a]/40" />
      </Section>

      {/* Style narrative */}
      <Section className="mt-8 space-y-4">
        <P>
          如今我们对缅因猫的血线也有了比较深入的了解，意识到血线与风格的复杂与多样，不再拘泥于「纯美血」「纯欧血」这种划分。
        </P>
        <P>
          因为缅因从不只有这两种风格。
        </P>
      </Section>

      {/* Highlighted original sentence */}
      <Section className="mt-8 px-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-px w-10 bg-[#d9b26a]/30" />
          <p className="text-center text-[16px] font-medium leading-[1.8] tracking-[0.02em] text-[#5b4a3a]">
            甜美小体、大体、大刷子、毛怪，
            <br />
            都代表不了全部的缅因猫。
          </p>
          <div className="h-px w-10 bg-[#d9b26a]/30" />
        </div>
      </Section>

      <Section className="mt-8 space-y-4">
        <P>
          在世界各地都有出色的缅因繁育人，很多繁育人的小猫都有着自己独特又有魅力的风格。
        </P>
        <P>
          我们追求的，就是在符合品标的前提下，做好健康筛查，繁育出健康亲人、表情精致甜酷、体格较大、毛量优秀，并有自己独特风格的小猫。
        </P>
      </Section>

      {/* Closing — natural continuation */}
      <Section className="mt-10 space-y-4">
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
      </Section>

      {/* Final closing node */}
      <Section className="mt-12 pb-12">
        <div className="flex flex-col items-center gap-4">
          <div className="h-px w-10 bg-[#d9b26a]/40" />
          <div className="flex items-center gap-3 font-display text-[13px] tracking-[0.2em] text-[#d9b26a]/80">
            <span>互相尊重</span>
            <span className="h-1 w-1 rounded-full bg-[#d9b26a]/60" />
            <span>互相选择</span>
            <span className="h-1 w-1 rounded-full bg-[#d9b26a]/60" />
            <span>互相信任</span>
          </div>
        </div>
      </Section>
    </PhoneFrame>
  );
}
