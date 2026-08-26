export const siteConfig = {
  name: "ПроТех76",
  description: "Интернет-магазин запчастей, навесного оборудования и комплектующих для мини-экскаваторов Rippa.",
  contact: {
    primaryPhone: {
      href: "tel:+79201309744",
      label: "+7 920 130-97-44"
    },
    secondaryPhone: {
      href: "tel:+79201089344",
      label: "+7 920 108-93-44"
    }
  },
  pickup: {
    streetAddress: "пр.-т Октября, д. 78д",
    city: "Ярославль",
    countryCode: "RU",
    latitude: 57.649298,
    longitude: 39.860342
  }
} as const;

export const pickupAddress = `${siteConfig.pickup.city}, ${siteConfig.pickup.streetAddress}`;
