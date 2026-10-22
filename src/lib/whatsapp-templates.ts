/**
 * WhatsApp message templates.
 *
 * The templates live in `settings.message_templates` (jsonb) so the shop can
 * edit them without a deploy. The seed's `order_to_shop` template is:
 *
 *   "Hi Tamera! Here is my order {order}\nName: {name}\nTotal: {total}\nDate needed: {date}"
 *
 * `renderTemplate` fills the placeholders; `orderToShopMessage` builds the
 * customer-facing order summary that goes into the WhatsApp button on the
 * confirmation page.
 */

export interface TemplateValues {
  order: string;
  name: string;
  total: string;
  date: string;
}

/** Replace every `{placeholder}` in the template with its value. */
export function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key as keyof TemplateValues];
    return value === undefined ? match : value;
  });
}

/** The `order_to_shop` template exactly as the seed defines it. */
export const ORDER_TO_SHOP_TEMPLATE =
  "Hi Tamera! Here is my order {order}\nName: {name}\nTotal: {total}\nDate needed: {date}";

/** Build the message a customer sends when they tap "Send on WhatsApp". */
export function orderToShopMessage(
  template: string,
  values: TemplateValues,
): string {
  return renderTemplate(template, values);
}
