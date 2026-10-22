/** Pure validation and formatting shared by the form and its tests. */
export function validateInquiry(values) {
  const errors = {};
  const name = String(values.name || '').trim();
  const specialization = String(values.specialization || '').trim();
  const contact = String(values.contact || '').trim();
  const message = String(values.message || '').trim();
  if (name.length < 2 || name.length > 80) errors.name = true;
  if (specialization.length < 2 || specialization.length > 120) errors.specialization = true;
  const email = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(contact);
  const telegram = /^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(contact);
  const phone = /^\+?[\d\s()-]+$/.test(contact) && contact.replace(/\D/g, '').length >= 10 && contact.replace(/\D/g, '').length <= 15;
  if (contact.length > 160 || !(email || telegram || phone)) errors.contact = true;
  if (message.length > 3000) errors.message = true;
  return { errors, values: { name, specialization, contact, message }, valid: Object.keys(errors).length === 0 };
}

export function formatInquiry(values, labels) {
  return [labels.heading, '', `${labels.name}: ${values.name}`, `${labels.specialization}: ${values.specialization}`, `${labels.contact}: ${values.contact}`, ...(values.message ? ['', `${labels.message}:`, values.message] : [])].join('\n');
}
