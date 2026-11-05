import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, Bean, Check, ChevronDown, Clock3,
  Coffee, Croissant, CupSoda, Leaf, LockKeyhole, Minus, Pencil, Plus, Search, ShoppingBag,
  Sparkles, Trash2, Users, X,
} from 'lucide-react';
import { api, type DailySummary, type MenuCategory, type MenuItem, type OrderStatus, type PublicOrder, type StaffOrder } from './api';

type View = 'menu' | 'staff';
type CartLine = { item: MenuItem; quantity: number };
type MenuDraft = Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>;

const categories: Array<'All' | MenuCategory> = ['All', 'Coffee', 'Tea', 'Pastry', 'Food', 'Other'];
const statuses: OrderStatus[] = ['Pending', 'Preparing', 'Ready', 'Collected'];
const categoryIcons: Record<MenuCategory, typeof Coffee> = {
  Coffee, Tea: Leaf, Pastry: Croissant, Food: Sparkles, Other: CupSoda,
};
const emptyDraft: MenuDraft = {
  name: '', description: '', category: 'Coffee', price: 0, available: true,
};
const money = (amount: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
}).format(amount);
const shortId = (id: string) => id.slice(0, 8).toUpperCase();
const prettyTime = (date: string) => new Date(date).toLocaleTimeString([], {
  hour: 'numeric', minute: '2-digit',
});

export default function App() {
  const [view, setView] = useState<View>('menu');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [receipt, setReceipt] = useState<PublicOrder | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [lookupOrder, setLookupOrder] = useState<PublicOrder | null>(null);
  const [message, setMessage] = useState('');
  const [staffToken, setStaffToken] = useState('');
  const [staffReady, setStaffReady] = useState(false);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffOrders, setStaffOrders] = useState<StaffOrder[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [draft, setDraft] = useState<MenuDraft>(emptyDraft);
  const [activeStaffTab, setActiveStaffTab] = useState<'orders' | 'menu'>('orders');
  const receiptRef = useRef<HTMLElement>(null);

  const loadMenu = async () => {
    setMenuLoading(true);
    try {
      setMenu(await api.menu());
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the menu.');
    } finally {
      setMenuLoading(false);
    }
  };

  useEffect(() => { void loadMenu(); }, []);
  useEffect(() => {
    if (receipt) receiptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [receipt]);

  const visibleMenu = useMemo(() => menu.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category;
    const query = search.trim().toLowerCase();
    return matchesCategory && (!query || `${item.name} ${item.description}`.toLowerCase().includes(query));
  }), [category, menu, search]);

  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);
  const cartTotal = cart.reduce((total, line) => total + line.item.price * line.quantity, 0);

  const changeQuantity = (item: MenuItem, change: number) => {
    setCart((current) => {
      const existing = current.find((line) => line.item.id === item.id);
      if (!existing && change > 0) return [...current, { item, quantity: change }];
      return current
        .map((line) => line.item.id === item.id ? { ...line, quantity: line.quantity + change } : line)
        .filter((line) => line.quantity > 0);
    });
  };

  const placeOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerName.trim() || cart.length === 0) return;
    setPlacingOrder(true);
    setMessage('');
    try {
      const order = await api.createOrder({
        customerName: customerName.trim(),
        notes: notes.trim(),
        items: cart.map(({ item, quantity }) => ({ menuItemId: item.id, quantity })),
      });
      setReceipt(order);
      setLookupId(order.id);
      setCart([]);
      setCustomerName('');
      setNotes('');
      setCartOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not place your order.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const lookUpOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setLookupOrder(null);
    setMessage('');
    try {
      setLookupOrder(await api.order(lookupId.trim()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Order not found.');
    }
  };

  const refreshStaff = async (token = staffToken) => {
    const [orders, daily] = await Promise.all([api.staffOrders(token), api.dailySummary(token)]);
    setStaffOrders(orders);
    setSummary(daily);
  };

  const signInStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    setStaffBusy(true);
    setMessage('');
    try {
      await refreshStaff();
      setStaffReady(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Staff sign-in failed.');
    } finally {
      setStaffBusy(false);
    }
  };

  const saveMenuItem = async (event: React.FormEvent) => {
    event.preventDefault();
    setStaffBusy(true);
    setMessage('');
    try {
      if (editingItem) await api.updateMenuItem(staffToken, editingItem.id, draft);
      else await api.createMenuItem(staffToken, draft);
      setDraft(emptyDraft);
      setEditingItem(null);
      await loadMenu();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save menu item.');
    } finally {
      setStaffBusy(false);
    }
  };

  const removeMenuItem = async (item: MenuItem) => {
    if (!window.confirm(`Remove ${item.name} from the menu?`)) return;
    setMessage('');
    try {
      await api.deleteMenuItem(staffToken, item.id);
      await loadMenu();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove menu item.');
    }
  };

  const updateStatus = async (order: StaffOrder, status: OrderStatus) => {
    try {
      await api.updateOrderStatus(staffToken, order.id, status);
      await refreshStaff();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update order status.');
    }
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" onClick={() => { setView('menu'); setReceipt(null); }}>
          <span className="brand-mark"><Bean size={21} strokeWidth={1.8} /></span>
          <span className="brand-name">daybreak<span>coffee</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'menu' ? 'nav-link active' : 'nav-link'} onClick={() => setView('menu')}>The menu</button>
          <a className="nav-link" href="#our-story">Our story</a>
          <a className="nav-link" href="#visit-us">Find us</a>
        </nav>
        <div className="header-actions">
          <button className="staff-link" onClick={() => { setView('staff'); setMessage(''); }}>
            <LockKeyhole size={15} /> <span>Staff</span>
          </button>
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Open basket, ${cartCount} items`}>
            <ShoppingBag size={17} /><span>Your order</span><b>{cartCount}</b>
          </button>
        </div>
      </header>

      {message && (
        <div className="toast" role="alert">
          <span>{message}</span><button aria-label="Dismiss message" onClick={() => setMessage('')}><X size={17} /></button>
        </div>
      )}

      {view === 'menu' ? (
        <>
          <main>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow"><span className="eyebrow-line" /> A LITTLE GOOD IN YOUR DAY</div>
                <h1>Good things<br />are <em>brewing.</em></h1>
                <p>Thoughtful coffee, fresh-from-the-oven treats, and a warm welcome. Made slowly, enjoyed whenever.</p>
                <a className="primary-button hero-cta" href="#menu">Explore the menu <ArrowDown size={16} /></a>
                <div className="hero-footnote"><span className="avatar-stack"><i>J</i><i>M</i><i>A</i></span><span>Made with love, every single day</span></div>
              </div>
              <div className="hero-art" aria-label="A cup of freshly brewed coffee">
                <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
                <div className="sun-disc" />
                <div className="hero-sticker"><Sparkles size={13} /> YOUR NEW<br />HAPPY PLACE</div>
                <div className="coffee-scene">
                  <div className="steam steam-one" /><div className="steam steam-two" /><div className="steam steam-three" />
                  <div className="coffee-cup"><div className="coffee-surface"><span /></div><div className="cup-handle" /><div className="cup-sleeve">DAY<br />BREAK</div></div>
                  <div className="cup-shadow" />
                </div>
                <div className="hero-caption"><span>01 / 04</span><span>THE PERFECT POUR</span><span className="caption-dots">● ○ ○ ○</span></div>
              </div>
              <a className="scroll-cue" href="#menu"><span /> SCROLL TO SAVOR</a>
            </section>

            {receipt && (
              <section className="receipt-banner" aria-live="polite" ref={receiptRef}>
                <span className="receipt-icon"><BadgeCheck size={23} /></span>
                <div><small>ORDER CONFIRMED</small><h2>You're on our list.</h2><p>Order <b>#{receipt.id}</b> · {money(receipt.total)} · We’ll get right to it.</p></div>
                <div className="receipt-status"><span className="status-dot pending" /> {receipt.status}</div>
                <button className="icon-button" aria-label="Dismiss order confirmation" onClick={() => setReceipt(null)}><X size={18} /></button>
              </section>
            )}

            <section id="menu" className="menu-section">
              <div className="section-heading">
                <div><div className="eyebrow"><span className="eyebrow-line" /> THE GOOD STUFF</div><h2>A menu worth<br className="mobile-break" /> <em>waking up for.</em></h2></div>
                <div className="menu-aside"><span>{String(visibleMenu.length).padStart(2, '0')} {visibleMenu.length === 1 ? 'ITEM' : 'ITEMS'}</span><p>Small batch. Big heart.<br />Always made fresh.</p></div>
              </div>
              <div className="menu-toolbar">
                <div className="category-tabs" role="group" aria-label="Menu categories">
                  {categories.map((name) => <button key={name} aria-pressed={category === name} className={category === name ? 'category-tab selected' : 'category-tab'} onClick={() => setCategory(name)}>{name}</button>)}
                </div>
                <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find your favorite" aria-label="Search the menu" /></label>
              </div>
              {menuLoading ? <div className="empty-state"><span className="loader" /> Loading today's menu...</div> : (
                <div className="menu-grid">
                  {visibleMenu.map((item, index) => {
                    const Icon = categoryIcons[item.category];
                    const inCart = cart.find((line) => line.item.id === item.id)?.quantity ?? 0;
                    return (
                      <article className={`menu-card ${!item.available ? 'unavailable' : ''}`} key={item.id}>
                        <div className={`product-art art-${index % 8}`}>
                          <span className="product-category"><Icon size={13} /> {item.category}</span>
                          <span className="product-number">{String(index + 1).padStart(2, '0')}</span>
                          <div className="product-illustration" aria-hidden="true">
                            {item.category === 'Coffee' ? <div className="tiny-cup"><span /></div> : item.category === 'Tea' ? <div className="tea-glass"><span /></div> : item.category === 'Pastry' ? <div className="pastry-shape"><i /><i /><i /></div> : <div className="food-plate"><span /></div>}
                          </div>
                          {!item.available && <span className="sold-out">SOLD OUT TODAY</span>}
                          {item.available && inCart > 0 && <span className="in-cart"><Check size={12} /> {inCart} IN BAG</span>}
                        </div>
                        <div className="product-details">
                          <div className="product-title"><h3>{item.name}</h3><span>{money(item.price)}</span></div>
                          <p>{item.description}</p>
                          <button className="add-button" disabled={!item.available} onClick={() => changeQuantity(item, 1)}>
                            {inCart > 0 ? 'Add one more' : 'Add to order'} <Plus size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {!menuLoading && visibleMenu.length === 0 && <div className="empty-state">Nothing on the menu matches that just yet.</div>}
              <div className="menu-bottom"><span>MADE FRESH, EVERY MORNING <span className="tiny-star">✳</span> ALWAYS SERVED WITH A SMILE</span><button onClick={() => setCartOpen(true)}>View your order <ArrowRight size={15} /></button></div>
            </section>

            <section className="order-lookup">
              <div className="lookup-icon"><Clock3 size={22} /></div>
              <div className="lookup-copy"><div className="eyebrow">ALREADY ORDERED?</div><h2>Follow your <em>coffee.</em></h2><p>Pop in your order number and see what’s happening.</p></div>
              <form className="lookup-form" onSubmit={lookUpOrder}><label htmlFor="order-lookup">Order number</label><div><input id="order-lookup" value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="Paste your full order ID" required /><button className="primary-button" type="submit">Check status <ArrowRight size={15} /></button></div>
                {lookupOrder && <span className="lookup-result"><span className={`status-dot ${lookupOrder.status.toLowerCase()}`} /> Order #{shortId(lookupOrder.id)} is <b>{lookupOrder.status}</b></span>}
              </form>
            </section>

            <section id="our-story" className="story-section">
              <div className="story-art"><div className="story-sun" /><div className="story-leaf leaf-one" /><div className="story-leaf leaf-two" /><span className="story-stamp">SINCE<br /><b>2018</b></span><span className="story-art-label">A SLOWER KIND OF MORNING</span></div>
              <div className="story-copy"><div className="eyebrow"><span className="eyebrow-line" /> A SEAT AT OUR TABLE</div><h2>More than coffee.<br /><em>A little ritual.</em></h2><p>We believe the best part of the day can be the simplest one. Good beans, kind people, and nowhere else you need to be.</p><a href="#visit-us" className="text-link">Come say hello <ArrowUpRight size={16} /></a><div className="story-note"><span>✳</span> Locally roasted. Lovingly poured. Always your neighborhood spot.</div></div>
            </section>

            <section id="visit-us" className="visit-section"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR CORNER OF THE WORLD</div><h2>Come on <em>in.</em></h2><p>Walk-ins, slow mornings, and second cups always welcome.</p></div><div className="visit-details"><div><span>FIND OUR DOOR</span><p>12 Morning Lane, The Neighborhood</p></div><div><span>WHEN WE'RE HERE</span><p>Every day, 7:00 am — 4:00 pm</p></div><a className="primary-button" href="mailto:hello@daybreak.coffee">Say hello <ArrowUpRight size={15} /></a></div></section>
          </main>
          <footer className="site-footer"><a className="brand footer-brand" href="#"><span className="brand-mark"><Bean size={20} /></span><span className="brand-name">daybreak<span>coffee</span></span></a><span>GOOD COFFEE. GOOD COMPANY. GOOD MORNING.</span><span>© DAYBREAK COFFEE 2026</span></footer>
        </>
      ) : (
        <main className="staff-page">
          <div className="staff-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> THE BEHIND-THE-COUNTER VIEW</div><h1>Staff <em>dashboard.</em></h1><p>Keep the good things moving.</p></div><button className="text-link" onClick={() => setView('menu')}><ArrowRight size={15} /> Back to the shop</button></div>
          {!staffReady ? (
            <form className="staff-login" onSubmit={signInStaff}><span className="login-icon"><LockKeyhole size={21} /></span><h2>Welcome back.</h2><p>Enter your staff access token to manage today's orders and menu.</p><label htmlFor="staff-token">Staff access token</label><input id="staff-token" type="password" autoComplete="current-password" value={staffToken} onChange={(event) => setStaffToken(event.target.value)} placeholder="Enter your token" required /><button className="primary-button" disabled={staffBusy}>{staffBusy ? 'Checking...' : 'Open dashboard'} <ArrowRight size={15} /></button></form>
          ) : (
            <>
              <div className="summary-grid">
                <div className="summary-card"><span>TODAY'S ORDERS</span><strong>{summary?.orderCount ?? 0}</strong><small><Users size={14} /> Across all statuses</small></div>
                <div className="summary-card"><span>TODAY'S SALES</span><strong>{money(summary?.revenue ?? 0)}</strong><small><BadgeCheck size={14} /> Confirmed order total</small></div>
                <div className="summary-card"><span>IN PROGRESS</span><strong>{(summary?.byStatus.Pending ?? 0) + (summary?.byStatus.Preparing ?? 0)}</strong><small><Clock3 size={14} /> Pending + preparing</small></div>
                <div className="summary-card summary-date"><span>REPORTING DATE</span><strong>{summary ? new Date(`${summary.date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}</strong><small>Daily overview</small></div>
              </div>
              <div className="staff-tabs"><button className={activeStaffTab === 'orders' ? 'staff-tab selected' : 'staff-tab'} onClick={() => setActiveStaffTab('orders')}>Orders <span>{staffOrders.length}</span></button><button className={activeStaffTab === 'menu' ? 'staff-tab selected' : 'staff-tab'} onClick={() => setActiveStaffTab('menu')}>Menu management</button><button className="staff-refresh" onClick={() => void refreshStaff()}><ArrowDown size={15} /> Refresh</button></div>
              {activeStaffTab === 'orders' ? <section className="staff-orders">
                {staffOrders.length === 0 ? <div className="staff-empty"><Coffee size={24} /><h3>Nothing brewing just yet.</h3><p>New customer orders will show up here.</p></div> : staffOrders.map((order) => (
                  <article className="staff-order" key={order.id}>
                    <div className="staff-order-main"><span className="staff-order-id">#{shortId(order.id)} <span className={`status-pill ${order.status.toLowerCase()}`}>{order.status}</span></span><h3>{order.customerName}</h3><p>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ')}</p>{order.notes && <small>Note: {order.notes}</small>}</div>
                    <div className="staff-order-time"><Clock3 size={14} /> {prettyTime(order.createdAt)}</div><strong className="staff-order-total">{money(order.total)}</strong>
                    <label className="status-select"><span>Update status</span><select value={order.status} onChange={(event) => void updateStatus(order, event.target.value as OrderStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={15} /></label>
                  </article>
                ))}
              </section> : (
                <section className="menu-admin">
                  <form className="menu-editor" onSubmit={saveMenuItem}><div><div className="eyebrow">{editingItem ? 'EDIT ITEM' : 'ADD SOMETHING GOOD'}</div><h2>{editingItem ? 'Update your menu.' : 'New to the menu?'}</h2></div>
                    <label>Item name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={80} required /></label>
                    <label>Description<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={300} required /></label>
                    <div className="editor-row"><label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as MenuCategory })}>{categories.filter((value) => value !== 'All').map((value) => <option key={value}>{value}</option>)}</select></label><label>Price ($)<input type="number" value={draft.price || ''} min="0.01" max="1000" step="0.01" onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} required /></label></div>
                    <label className="availability-check"><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} /> Available to order</label>
                    <div className="editor-actions"><button className="primary-button" disabled={staffBusy}>{editingItem ? 'Save changes' : 'Add to menu'} <Plus size={15} /></button>{editingItem && <button type="button" className="text-link" onClick={() => { setEditingItem(null); setDraft(emptyDraft); }}>Cancel</button>}</div>
                  </form>
                  <div className="admin-items"><div className="eyebrow">CURRENT MENU · {menu.length} ITEMS</div>{menu.map((item) => <div className="admin-menu-item" key={item.id}><span className="admin-item-icon"><Coffee size={17} /></span><div><strong>{item.name}</strong><small>{item.category} · {money(item.price)} · {item.available ? 'Available' : 'Sold out'}</small></div><button className="icon-button" aria-label={`Edit ${item.name}`} onClick={() => { setEditingItem(item); setDraft({ name: item.name, description: item.description, category: item.category, price: item.price, available: item.available }); }}><Pencil size={16} /></button><button className="icon-button danger" aria-label={`Delete ${item.name}`} onClick={() => void removeMenuItem(item)}><Trash2 size={16} /></button></div>)}</div>
                </section>
              )}
              <button className="sign-out" onClick={() => { setStaffReady(false); setStaffToken(''); setStaffOrders([]); setSummary(null); }}>Sign out of staff dashboard</button>
            </>
          )}
        </main>
      )}

      {cartOpen && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
        <aside className="cart-drawer" aria-label="Your order">
          <div className="drawer-header"><div><div className="eyebrow">SOMETHING DELICIOUS</div><h2>Your <em>order.</em></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close basket"><X size={20} /></button></div>
          <div className="drawer-lines">
            {cart.length === 0 ? <div className="cart-empty"><ShoppingBag size={26} /><h3>Your bag is taking a breather.</h3><p>Pick something lovely from the menu to get started.</p><button className="text-link" onClick={() => { setCartOpen(false); document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }); }}>Explore the menu <ArrowRight size={15} /></button></div> : cart.map(({ item, quantity }) => <div className="cart-line" key={item.id}><div className="cart-line-art"><Coffee size={21} /></div><div className="cart-line-info"><strong>{item.name}</strong><span>{money(item.price)} each</span><div className="quantity-control"><button aria-label={`Remove one ${item.name}`} onClick={() => changeQuantity(item, -1)}><Minus size={13} /></button><b>{quantity}</b><button aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(item, 1)}><Plus size={13} /></button></div></div><strong className="cart-line-total">{money(item.price * quantity)}</strong></div>)}
          </div>
          {cart.length > 0 && <form className="checkout" onSubmit={placeOrder}><label htmlFor="customer-name">Your name</label><input id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="What should we call you?" maxLength={80} required /><label htmlFor="order-notes">Anything we should know? <span>OPTIONAL</span></label><textarea id="order-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Milk preference, a little extra cinnamon..." maxLength={300} rows={2} /><div className="checkout-total"><span>Total <small>{cartCount} {cartCount === 1 ? 'item' : 'items'}</small></span><strong>{money(cartTotal)}</strong></div><button className="primary-button checkout-button" disabled={placingOrder}>{placingOrder ? 'Placing your order...' : 'Place my order'} <ArrowRight size={16} /></button><p className="checkout-note"><LockKeyhole size={12} /> Your order is sent securely to our kitchen.</p></form>}
        </aside>
      </div>}
    </div>
  );
}
