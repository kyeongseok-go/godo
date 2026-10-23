interface ChoiceOption<T extends string> {
  value: T
  label: string
}

interface ChoiceGroupProps<T extends string> {
  legend: string
  name: string
  value: T
  options: readonly ChoiceOption<T>[]
  onChange: (value: T) => void
}

/** 하나만 고르는 칩 묶음. 실제 라디오 입력을 쓰므로 방향키 이동과 읽기 지원이 기본으로 따라온다. */
export function ChoiceGroup<T extends string>({ legend, name, value, options, onChange }: ChoiceGroupProps<T>) {
  return (
    <fieldset className="sum-field">
      <legend className="sum-field__legend">{legend}</legend>
      <div className="sum-chips">
        {options.map((option) => (
          <label key={option.value} className="sum-chip">
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span className="sum-chip__face">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
