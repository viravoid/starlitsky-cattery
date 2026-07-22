import { useState, type ReactNode } from "react";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { CheckIcon, HeartIcon, PaperIcon } from "@/components/mobile/icons";
import type {
  AcceptOptionId,
  QuestionnaireChoiceOption,
  QuestionnaireChoiceQuestion,
  QuestionnaireContent,
  QuestionnaireTextQuestion,
} from "@/lib/questionnaire-content";

type Values = Record<string, string>;

function GroupTitle({ no, cn }: { no: string; cn: string }) {
  return (
    <div className="mb-4 mt-8 flex items-baseline gap-2.5 first:mt-2">
      <span className="font-display text-[13px] font-semibold text-violet/70">{no}</span>
      <h2 className="text-[15px] font-semibold text-heading">{cn}</h2>
    </div>
  );
}

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-[13px] font-medium text-heading">
      {children}
      {required && <span className="ml-0.5 text-[#c46a6a]">*</span>}
    </span>
  );
}

function TextField({
  question,
  required,
  type = "text",
  value,
  onChange,
  error,
}: {
  question: QuestionnaireTextQuestion;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const placeholder = question.placeholder.trim() || undefined;
  return (
    <label className="block">
      <Label required={required}>{question.label}</Label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-2xl border bg-card px-4 py-3 text-[14px] text-card-foreground outline-none placeholder:text-warm focus:border-primary ${
          error ? "border-[#c46a6a]" : "border-border"
        }`}
      />
      {error && <span className="mt-1 block text-[11px] text-[#c46a6a]">{error}</span>}
    </label>
  );
}

function RadioField<TId extends string>({
  question,
  required,
  value,
  onChange,
}: {
  question: QuestionnaireChoiceQuestion<TId>;
  required?: boolean;
  value: string;
  onChange: (value: TId) => void;
}) {
  const selectOption = (id: TId) => {
    onChange(id);
  };

  return (
    <div>
      <Label required={required}>{question.label}</Label>
      <div className="flex flex-wrap gap-2">
        {question.options.map((option) => (
          <OptionButton
            key={option.id}
            option={option}
            selected={value === option.id}
            onClick={() => selectOption(option.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CommitBlock({
  text,
  options,
  value,
  onChange,
}: {
  text: string;
  options: QuestionnaireChoiceOption<AcceptOptionId>[];
  value: string;
  onChange: (value: AcceptOptionId) => void;
}) {
  const selectOption = (id: AcceptOptionId) => {
    onChange(id);
  };

  return (
    <div className="rounded-[1.25rem] border border-border bg-card/60 p-4">
      <p className="text-[13px] leading-[1.9] text-foreground">
        {text}
        <span className="ml-0.5 text-[#c46a6a]">*</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <OptionButton
            key={option.id}
            option={option}
            selected={value === option.id}
            onClick={() => selectOption(option.id)}
          />
        ))}
      </div>
    </div>
  );
}

function OptionButton<TId extends string>({
  option,
  selected,
  onClick,
}: {
  option: QuestionnaireChoiceOption<TId>;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-option-id={option.id}
      className={`pressable rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
        selected
          ? "bg-primary text-primary-foreground shadow-card"
          : "border border-border bg-card text-muted-foreground"
      }`}
    >
      {option.label}
    </button>
  );
}

export function QuestionnaireView({
  content,
  preview = false,
}: {
  content: QuestionnaireContent;
  preview?: boolean;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState<Values>({});
  const [phoneError, setPhoneError] = useState("");
  const intro = content.intro.trim();
  const privacyNotice = content.privacyNotice.trim();
  const ps = content.ps.trim();
  const successBody = content.successBody.trim();

  const set = (key: string) => (value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const val = (key: string) => values[key] ?? "";

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
      <PhoneFrame
        title="选猫问卷"
        backTo="/"
        outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
        frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
      >
        <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-sky/25">
            <CheckIcon className="h-10 w-10 text-violet" />
          </span>
          <h2 className="mt-5 text-[18px] font-semibold text-heading">{content.successTitle}</h2>
          {successBody && (
            <p className="mt-2 text-[13px] leading-relaxed text-foreground">{successBody}</p>
          )}
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
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
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
        <div className="flex items-center gap-2">
          <HeartIcon className="h-6 w-6 text-violet" />
          <h1 className="text-[19px] font-semibold text-heading">选猫问卷</h1>
        </div>
        {(intro || privacyNotice) && (
          <div className="mt-3 rounded-[1.25rem] bg-gradient-cream px-4 py-4">
            {intro && <p className="text-[12.5px] leading-[1.9] text-foreground">{intro}</p>}
            {privacyNotice && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {privacyNotice}
              </p>
            )}
          </div>
        )}

        <GroupTitle no="一" cn="基本信息" />
        <div className="space-y-4">
          <TextField
            question={content.basicInfo.name}
            required
            value={val("name")}
            onChange={set("name")}
          />
          <RadioField
            question={content.basicInfo.gender}
            required
            value={val("gender")}
            onChange={set("gender")}
          />
          <TextField
            question={content.basicInfo.phone}
            required
            type="tel"
            value={val("phone")}
            onChange={set("phone")}
            error={phoneError}
          />
          <TextField
            question={content.basicInfo.age}
            required
            type="number"
            value={val("age")}
            onChange={set("age")}
          />
          <TextField
            question={content.basicInfo.job}
            required
            value={val("job")}
            onChange={set("job")}
          />
          <TextField
            question={content.basicInfo.city}
            required
            value={val("city")}
            onChange={set("city")}
          />
        </div>

        <GroupTitle no="二" cn="养猫经验" />
        <div className="space-y-4">
          <RadioField
            question={content.catExperience.experience}
            required
            value={val("experience")}
            onChange={set("experience")}
          />
          <RadioField
            question={content.catExperience.residents}
            required
            value={val("residents")}
            onChange={set("residents")}
          />
          {val("residents") === "yes" && (
            <RadioField
              question={content.catExperience.residentsNeutered}
              value={val("residentsNeutered")}
              onChange={set("residentsNeutered")}
            />
          )}
        </div>

        <GroupTitle no="三" cn="居住与家庭环境" />
        <div className="space-y-4">
          <RadioField
            question={content.livingEnvironment.hasKids}
            required
            value={val("hasKids")}
            onChange={set("hasKids")}
          />
          <RadioField
            question={content.livingEnvironment.housing}
            required
            value={val("housing")}
            onChange={set("housing")}
          />
          <RadioField
            question={content.livingEnvironment.windowSealed}
            required
            value={val("windowSealed")}
            onChange={set("windowSealed")}
          />
          <RadioField
            question={content.livingEnvironment.familyAgree}
            required
            value={val("familyAgree")}
            onChange={set("familyAgree")}
          />
        </div>

        <GroupTitle no="四" cn="选猫偏好" />
        <div className="space-y-4">
          <RadioField
            question={content.catPreference.wantGender}
            required
            value={val("wantGender")}
            onChange={set("wantGender")}
          />
          <TextField
            question={content.catPreference.wantColor}
            required
            value={val("wantColor")}
            onChange={set("wantColor")}
          />
          <TextField
            question={content.catPreference.budget}
            required
            value={val("budget")}
            onChange={set("budget")}
          />
          <RadioField
            question={content.catPreference.acceptNeuter}
            required
            value={val("acceptNeuter")}
            onChange={set("acceptNeuter")}
          />
          <RadioField
            question={content.catPreference.monthlySpend}
            required
            value={val("monthlySpend")}
            onChange={set("monthlySpend")}
          />
        </div>

        <GroupTitle no="五" cn="饲养理念与承诺" />
        <div className="space-y-3">
          <CommitBlock
            text={content.commitments.scientificFeeding}
            options={content.commitments.options}
            value={val("scientificFeeding")}
            onChange={set("scientificFeeding")}
          />
          <CommitBlock
            text={content.commitments.acceptActive}
            options={content.commitments.options}
            value={val("acceptActive")}
            onChange={set("acceptActive")}
          />
          <CommitBlock
            text={content.commitments.commitment}
            options={content.commitments.options}
            value={val("commitment")}
            onChange={set("commitment")}
          />
        </div>

        {ps && <p className="mt-7 text-[12px] leading-[1.9] text-muted-foreground">{ps}</p>}
      </Section>
    </PhoneFrame>
  );
}
