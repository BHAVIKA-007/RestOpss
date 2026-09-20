const roleRoutes = {
  customer: '/customer',
  owner: '/owner',
  manager: '/manager',
  waiter: '/waiter',
  chef: '/chef',
  cashier: '/cashier',
  host: '/host',
}

const rolePathPrefixes = Object.fromEntries(
  Object.entries(roleRoutes).map(([role, route]) => [role, `${route}/`])
)

export function getRoleRoute(role) {
  return roleRoutes[role] || '/discovery'
}

export function isPathAllowedForRole(pathname, role) {
  const prefix = rolePathPrefixes[role]
  return pathname === roleRoutes[role] || Boolean(prefix && pathname.startsWith(prefix))
}