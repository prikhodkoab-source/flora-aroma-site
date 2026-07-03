export const siteContacts = {
  phoneDisplay: "+38 050 0272882",
  phoneHref: "tel:+380500272882",
  emailDisplay: "Flora_&_Aroma@gmail.com",
  emailHref: "mailto:Flora_%26_Aroma@gmail.com",
  facebookUrl: "https://www.facebook.com/share/1HhvejhSAr/",
  telegramUrl: "https://t.me/FLORA_AROMA_GARDEN"
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
