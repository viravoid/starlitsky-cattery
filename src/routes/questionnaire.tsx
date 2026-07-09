import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { PaperIcon, CheckIcon, HeartIcon } from "@/components/mobile/icons";


export const Route = createFileRoute("/questionnaire")({
  head: () => ({
    meta: [
      { title: "选猫问卷 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍双向选择问卷，帮助我们了解你的养猫环境、饲养理念与选猫需求，方便后续沟通。",
      },
    ],
  }),
  component: Questionnaire,
});

type Values = Record<string, string>;

/** Grouped section header — Roman numeral + label, no heavy card. */
function GroupTitle({ no, cn }: { no: string; cn: string }) {
  return (
    <div className="mb-4 mt-8 flex items-baseline gap-2.5 first:mt-2">
      <span className="font-display text-[13px] font-semibold text-violet/70">
        {no}
      </span>
      <h2 className="text-[15px] font-semibold text-heading">{cn}</h2>
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-[13px] font-medium text-heading">
      {children}
      {required && <span className="ml-0.5 text-[#7A2F36]">*</span>}
    </span>
  );
}

function TextField({
  label,
  placeholder,
  required,
  type = "text",
  value,
  onChange,
  error,
}: {
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-2xl border bg-card px-4 py-3 text-[14px] text-card-foreground outline-none placeholder:text-warm focus:border-primary ${
          error ? "border-[#7A2F36]" : "border-border"
        }`}
      />
      {error && <span className="mt-1 block text-[11px] text-[#7A2F36]">{error}</span>}
    </label>
  );
}

function RadioField({
  label,
  options,
  required,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`pressable rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
              value === o
                ? "bg-primary text-primary-foreground shadow-card"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Longer commitment questions get their own calm block. */
function CommitBlock({
  no,
  text,
  value,
  onChange,
}: {
  no: string;
  text: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = ["能接受", "需要进一步了解", "不能接受"];
  return (
    <div className="rounded-[1.25rem] border border-border bg-card/60 p-4">
      <p className="text-[13px] leading-[1.9] text-foreground">
        <span className="mr-1 font-semibold text-violet/70">{no}</span>
        {text}
        <span className="ml-0.5 text-[#7A2F36]">*</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`pressable rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
              value === o
                ? "bg-primary text-primary-foreground shadow-card"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Questionnaire() {
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState<Values>({});
  const [phoneError, setPhoneError] = useState("");

  const set = (k: string) => (v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));
  const val = (k: string) => values[k] ?? "";

  const onSubmit = () => {
    const phone = val("phone").trim();
    if (phone && !/^1\d{10}$/.test(phone)) {
      setPhoneError("请输入正确的 11 位手机号");
      return;
    }
    setPhoneError("");
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <PhoneFrame title="选猫问卷" backTo="/">
        <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-sky/25">
            <CheckIcon className="h-10 w-10 text-violet" />
          </span>
          <h2 className="mt-5 text-[18px] font-semibold text-heading">
            问卷已提交，感谢你的填写
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground">
            我们会尽快查看你的问卷，请耐心等待回复。
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="pressable mt-6 text-[13px] font-semibold text-violet"
          >
            返回问卷
          </button>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame
      title="选猫问卷"
      backTo="/"

      bottomBar={
        <div className="border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
          <button
            onClick={onSubmit}
            className="pressable flex w-full items-center justify-center gap-2 rounded-full bg-violet py-3.5 text-[15px] font-semibold text-white shadow-card"
          >
            <PaperIcon className="h-5 w-5" /> 提交选猫问卷
          </button>
        </div>
      }
    >
      <Section className="pb-6 pt-3">
        {/* Intro */}
        <div className="flex items-center gap-2">
          <HeartIcon className="h-6 w-6 text-violet" />
          <h1 className="text-[19px] font-semibold text-heading">选猫问卷</h1>
        </div>
        <div className="mt-3 rounded-[1.25rem] bg-gradient-cream px-4 py-4">
          <p className="text-[12.5px] leading-[1.9] text-foreground">
            正规猫舍双向选择～请有购买意向的朋友填写一下问卷，方便我们了解您，谢谢配合！这是一份双向选择问卷，用于帮助我们了解你的养猫环境、饲养理念与选猫需求。填写后，猫舍会根据情况与你进一步沟通。
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            以下信息仅用于猫舍双向选择与后续沟通，不会公开展示。
          </p>
        </div>

        {/* 一、基本信息 */}
        <GroupTitle no="一" cn="基本信息" />
        <div className="space-y-4">
          <TextField
            label="真实姓名"
            required
            placeholder="请输入真实姓名"
            value={val("name")}
            onChange={set("name")}
          />
          <RadioField
            label="性别"
            required
            options={["女", "男", "其他", "不便透露"]}
            value={val("gender")}
            onChange={set("gender")}
          />
          <TextField
            label="电话"
            required
            type="tel"
            placeholder="请输入手机号"
            value={val("phone")}
            onChange={set("phone")}
            error={phoneError}
          />
          <TextField
            label="年龄"
            required
            type="number"
            placeholder="请输入年龄"
            value={val("age")}
            onChange={set("age")}
          />
          <TextField
            label="职业"
            required
            placeholder="请输入职业"
            value={val("job")}
            onChange={set("job")}
          />
          <TextField
            label="现居城市"
            required
            placeholder="例如：西安"
            value={val("city")}
            onChange={set("city")}
          />
        </div>

        {/* 二、养猫经验 */}
        <GroupTitle no="二" cn="养猫经验" />
        <div className="space-y-4">
          <RadioField
            label="是否有养猫经验"
            required
            options={["有", "没有"]}
            value={val("experience")}
            onChange={set("experience")}
          />
          <RadioField
            label="家里是否有原住民"
            required
            options={["有", "没有"]}
            value={val("residents")}
            onChange={set("residents")}
          />
          {val("residents") === "有" && (
            <RadioField
              label="原住民是否绝育"
              options={["已绝育", "未绝育", "部分绝育", "暂不适用"]}
              value={val("residentsNeutered")}
              onChange={set("residentsNeutered")}
            />
          )}
        </div>

        {/* 三、居住与家庭环境 */}
        <GroupTitle no="三" cn="居住与家庭环境" />
        <div className="space-y-4">
          <RadioField
            label="是否有小孩"
            required
            options={["有", "没有"]}
            value={val("hasKids")}
            onChange={set("hasKids")}
          />
          <RadioField
            label="是否租房，如果租房房东是否同意养猫"
            required
            options={[
              "自有住房",
              "租房，房东同意养猫",
              "租房，尚未确认",
              "租房，房东不同意",
            ]}
            value={val("housing")}
            onChange={set("housing")}
          />
          <RadioField
            label="住房是否有封窗"
            required
            options={["已封窗", "暂未封窗但可以封", "无法封窗"]}
            value={val("windowSealed")}
            onChange={set("windowSealed")}
          />
          <RadioField
            label="家庭成员或室友是否同意养猫"
            required
            options={["全部同意", "部分同意", "尚未沟通", "不同意"]}
            value={val("familyAgree")}
            onChange={set("familyAgree")}
          />
        </div>

        {/* 四、选猫偏好 */}
        <GroupTitle no="四" cn="选猫偏好" />
        <div className="space-y-4">
          <RadioField
            label="想要公猫 or 母猫（现猫无需填写）"
            required
            options={["公猫", "母猫", "都可以", "咨询现猫，暂不填写"]}
            value={val("wantGender")}
            onChange={set("wantGender")}
          />
          <TextField
            label="想要幼猫颜色"
            required
            placeholder="例如银虎斑、棕虎斑、玳瑁、都可以等"
            value={val("wantColor")}
            onChange={set("wantColor")}
          />
          <TextField
            label="接受的价格范围（现猫无需填写）"
            required
            placeholder="例如 1w-2w、2w-3w、可根据小猫情况沟通等"
            value={val("budget")}
            onChange={set("budget")}
          />
          <RadioField
            label="能否接受绝育"
            required
            options={["能接受", "需要进一步了解", "不能接受"]}
            value={val("acceptNeuter")}
            onChange={set("acceptNeuter")}
          />
          <RadioField
            label="每个月给猫支出范围"
            required
            options={["300 以内", "300-500", "500-1000", "1000 以上"]}
            value={val("monthlySpend")}
            onChange={set("monthlySpend")}
          />
        </div>

        {/* 五、饲养理念与承诺 */}
        <GroupTitle no="五" cn="饲养理念与承诺" />
        <div className="space-y-3">
          <CommitBlock
            no="19"
            text="能否接受科学（天然粮 / 主食罐 / 生骨肉 / 熟自制）喂养，承诺不喂垃圾粮、不喂来源不明确的生肉"
            value={val("scientificFeeding")}
            onChange={set("scientificFeeding")}
          />
          <CommitBlock
            no="20"
            text="小猫比较活泼，日常有可能会有抓挠家具、咬线、玩闹误伤等行为，能否接受"
            value={val("acceptActive")}
            onChange={set("acceptActive")}
          />
          <CommitBlock
            no="21"
            text="是否承诺对小猫不离不弃，如遇不可抗因素无法继续饲养，必须与猫舍进行联系，猫舍有权知晓小猫未来的去向，能否接受"
            value={val("commitment")}
            onChange={set("commitment")}
          />
        </div>

        {/* PS */}
        <p className="mt-7 text-[12px] leading-[1.9] text-muted-foreground">
          PS：性别和颜色仅做了解，排队不分颜色窝次，不限选猫时间。
        </p>
      </Section>
    </PhoneFrame>
  );
}
