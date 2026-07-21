const ORDER_PREFIX = /^\d+__/

export function stripOrderPrefix(value = '') {
  return value.replace(ORDER_PREFIX, '')
}

export function stripExtension(value = '') {
  return value.replace(/\.[^.]+$/, '')
}

export function formatDisplayName(value = '') {
  return stripOrderPrefix(stripExtension(value))
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
}

export function extractOrder(value = '') {
  const match = value.match(/^(\d+)/)
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER
}

export function slugify(value = '') {
  return formatDisplayName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
