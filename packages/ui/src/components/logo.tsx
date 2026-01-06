import logoMark from "../assets/logo-mark.png"

export const Mark = (props: { class?: string }) => {
  return (
    <img
      data-component="logo-mark"
      src={logoMark}
      alt="OpenCode"
      classList={{ [props.class ?? ""]: !!props.class }}
      class="h-6 object-contain"
    />
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 234 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g>
        <path d="M18 30H6V18H18V30Z" fill="var(--icon-weak-base)" />
        <path d="M18 12H6V30H18V12ZM24 36H0V6H24V36Z" fill="var(--icon-base)" />
        <path d="M48 30H36V18H48V30Z" fill="var(--icon-weak-base)" />
        <path d="M36 30H48V12H36V30ZM54 36H36V42H30V6H54V36Z" fill="var(--icon-base)" />
        <path d="M84 24V30H66V24H84Z" fill="var(--icon-weak-base)" />
        <path d="M84 24H66V30H84V36H60V6H84V24ZM66 18H78V12H66V18Z" fill="var(--icon-base)" />
        <path d="M108 36H96V18H108V36Z" fill="var(--icon-weak-base)" />
        <path d="M108 12H96V36H90V6H108V12ZM114 36H108V12H114V36Z" fill="var(--icon-base)" />
        <path d="M144 30H126V18H144V30Z" fill="var(--icon-weak-base)" />
        <path d="M144 12H126V30H144V36H120V6H144V12Z" fill="var(--icon-strong-base)" />
        <path d="M168 30H156V18H168V30Z" fill="var(--icon-weak-base)" />
        <path d="M168 12H156V30H168V12ZM174 36H150V6H174V36Z" fill="var(--icon-strong-base)" />
        <path d="M198 30H186V18H198V30Z" fill="var(--icon-weak-base)" />
        <path d="M198 12H186V30H198V12ZM204 36H180V6H198V0H204V36Z" fill="var(--icon-strong-base)" />
        <path d="M234 24V30H216V24H234Z" fill="var(--icon-weak-base)" />
        <path d="M216 12V18H228V12H216ZM234 24H216V30H234V36H210V6H234V24Z" fill="var(--icon-strong-base)" />
      </g>
    </svg>
  )
}

export const AnyonLogo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 144 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g>
        {/* A at 0-24 */}
        <path d="M18 30H6V24H18V30Z" fill="rgba(255, 255, 255, 0.5)" />
        <path d="M24 36H0V6H24V36ZM18 12H6V18H18V12ZM18 24H6V36H18V24Z" fill="rgba(255, 255, 255, 0.9)" />
        {/* N at 30-54 */}
        <path d="M48 36H36V18H48V36Z" fill="rgba(255, 255, 255, 0.5)" />
        <path d="M48 12H36V36H30V6H48V12ZM54 36H48V12H54V36Z" fill="rgba(255, 255, 255, 0.9)" />
        {/* Y at 60-84 */}
        <path d="M78 30H66V24H78V30Z" fill="rgba(255, 255, 255, 0.5)" />
        <path d="M66 18H60V6H66V18ZM84 18H78V6H84V18ZM78 36H66V18H78V36Z" fill="rgba(255, 255, 255, 0.9)" />
        {/* O at 90-114 */}
        <path d="M108 30H96V18H108V30Z" fill="rgba(255, 255, 255, 0.5)" />
        <path d="M108 12H96V30H108V12ZM114 36H90V6H114V36Z" fill="rgba(255, 255, 255, 0.9)" />
        {/* N at 120-144 */}
        <path d="M138 36H126V18H138V36Z" fill="rgba(255, 255, 255, 0.5)" />
        <path d="M138 12H126V36H120V6H138V12ZM144 36H138V12H144V36Z" fill="rgba(255, 255, 255, 0.9)" />
      </g>
    </svg>
  )
}
