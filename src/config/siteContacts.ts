export const siteContacts = {
  phoneDisplay: "+38 050 0272882",
  phoneHref: "tel:+380500272882",
  emailDisplay: "Flora_&_Aroma@gmail.com",
  emailHref: "mailto:Flora_%26_Aroma@gmail.com",
  facebookUrl: "https://www.facebook.com/share/1HhvejhSAr/",
  instagramUrl: "",
  tiktokUrl: "",
  telegramUrl: "https://t.me/FLORA_AROMA_GARDEN",
  consultationTelegramUrl: "https://t.me/+380500272882?text=%D0%94%D0%BE%D0%B1%D1%80%D0%BE%D0%B3%D0%BE%20%D0%B4%D0%BD%D1%8F%2C%20%D1%86%D1%96%D0%BA%D0%B0%D0%B2%D0%BB%D1%8F%D1%82%D1%8C%20%D1%80%D0%BE%D1%81%D0%BB%D0%B8%D0%BD%D0%B8"
} as const;

export const socialLinks = [
  {
    key: "telegram",
    label: "Telegram",
    url: siteContacts.telegramUrl
  },
  {
    key: "facebook",
    label: "Facebook",
    url: siteContacts.facebookUrl
  }
].filter((link) => link.url);
