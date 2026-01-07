const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://anyon.cc" : `https://${stage}.anyon.cc`,
  console: stage === "production" ? "https://anyon.cc/auth" : `https://${stage}.anyon.cc/auth`,
  email: "contact@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/SL-IT-AMAZING/opencode",
  discord: "https://anyon.cc/discord",
  headerLinks: [
    { name: "Home", url: "/" },
    { name: "Docs", url: "/docs/" },
  ],
}
