// Notion-style Markdown Editor based on SlashMD
// https://github.com/wolfdavo/SlashMD

// Import Prism before anything else - required by @lexical/code
import Prism from "prismjs"

// Make Prism available globally for @lexical/code
;(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism

// Import Prism languages for syntax highlighting
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-tsx"
import "prismjs/components/prism-python"
import "prismjs/components/prism-json"
import "prismjs/components/prism-bash"
import "prismjs/components/prism-sql"
import "prismjs/components/prism-yaml"
import "prismjs/components/prism-markdown"
import "prismjs/components/prism-java"
import "prismjs/components/prism-c"
import "prismjs/components/prism-cpp"
import "prismjs/components/prism-csharp"
import "prismjs/components/prism-go"
import "prismjs/components/prism-rust"
import "prismjs/components/prism-ruby"
import "prismjs/components/prism-php"
import "prismjs/components/prism-swift"
import "prismjs/components/prism-kotlin"
import "prismjs/components/prism-scss"
import "prismjs/components/prism-powershell"
import "prismjs/components/prism-docker"
import "prismjs/components/prism-graphql"

// Export the Editor component
export { Editor } from "./app/editor/Editor"

// Export types
export type { ImagePathResolution, SlashMDSettings } from "./types"
