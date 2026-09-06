export function formatOrderItems(items = []) {
  return items.map((item) => {
    const menuItem = item.menuItem && typeof item.menuItem === 'object' ? item.menuItem : null

    return {
      name: item.name || menuItem?.name || 'Menu item',
      price: Number(item.price ?? item.priceAtOrder ?? menuItem?.price ?? 0),
      quantity: Number(item.quantity || 0),
    }
  })
}
