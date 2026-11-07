import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import {
  ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, Bean, Check, ChevronDown, Clock3, Coffee,
  Croissant, Home, Leaf, LockKeyhole, MapPin, Minus, Pencil, Plus, Search, ShoppingBag,
  Trash2, Users, UtensilsCrossed, X,
} from 'lucide-react';
import { api, type DailySummary, type MenuCategory, type MenuItem, type OrderStatus, type PublicOrder, type StaffOrder } from './api';
import FloatingNav, { type FloatingNavItem } from './components/ui/floating-nav';

type View = 'menu' | 'staff';
type CartLine = { item: MenuItem; quantity: number };
type MenuDraft = Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>;

const categories: Array<'All' | MenuCategory> = ['All', 'Coffee', 'Tea', 'Pastry', 'Food', 'Other'];
const statuses: OrderStatus[] = ['Pending', 'Preparing', 'Ready', 'Collected'];
const emptyDraft: MenuDraft = {
  name: '', description: '', category: 'Coffee', price: 0, available: true,
};
// Prices are in Lesotho maloti, written M45.00.
const money = (amount: number) => `M${amount.toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`;
const shortId = (id: string) => id.slice(0, 8).toUpperCase();
const prettyTime = (date: string) => new Date(date).toLocaleTimeString([], {
  hour: 'numeric', minute: '2-digit',
});

// Starter items have their own photo; anything staff add uses their category's.
const photoByName: Record<string, string> = {
  'House Espresso': 'espresso',
  'Oat Milk Latte': 'oat-latte',
  'Honey Cinnamon Cappuccino': 'cappuccino',
  'Iced Vanilla Cold Brew': 'cold-brew',
  'Jasmine Green Tea': 'green-tea',
  'Butter Croissant': 'croissant',
  'Almond Morning Bun': 'morning-bun',
  'Avocado Toast': 'avocado-toast',
};
const photoByCategory: Record<MenuCategory, string> = {
  Coffee: 'latte-croissants', Tea: 'green-tea', Pastry: 'pastries', Food: 'avocado-toast', Other: 'beans',
};
const photoFor = (item: MenuItem) => `/images/${photoByName[item.name] ?? photoByCategory[item.category]}.jpg`;

const reasons: Array<{ title: string; text: string; photo: string; category: MenuCategory; action: string }> = [
  { title: 'Roasted with care', text: 'Small batches, pulled by people who taste every one.', photo: 'portafilter', category: 'Coffee', action: 'See the coffee' },
  { title: 'Baked every morning', text: 'Butter, patience and a warm oven, long before we open.', photo: 'pastries', category: 'Pastry', action: 'See the pastries' },
  { title: 'Made to order', text: 'Simple plates put together fresh when you ask for them.', photo: 'avocado-toast', category: 'Food', action: 'See the food' },
];
const promises = [
  { icon: Bean, title: 'Freshly roasted', text: 'Good beans, carefully chosen.' },
  { icon: Croissant, title: 'Baked daily', text: 'Out of the oven every morning.' },
  { icon: ShoppingBag, title: 'Order ahead', text: 'Choose online, skip the queue.' },
  { icon: Clock3, title: 'Track your order', text: 'See when it is ready to collect.' },
];

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

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
  const [activeSection, setActiveSection] = useState('top');
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);
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

  // Scroll once the shop page is on screen, which may be a render after the click.
  useEffect(() => {
    if (view !== 'menu' || !pendingScroll) return;
    document.getElementById(pendingScroll)?.scrollIntoView({ behavior: 'smooth' });
    setPendingScroll(null);
  }, [view, pendingScroll]);

  // Keep the floating nav on the section near the top of the screen.
  useEffect(() => {
    if (view !== 'menu') return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id);
    }, { rootMargin: '-28% 0px -70% 0px' });
    for (const id of ['top', 'menu', 'track', 'visit']) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [view]);

  const visibleMenu = useMemo(() => menu.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category;
    const query = search.trim().toLowerCase();
    return matchesCategory && (!query || `${item.name} ${item.description}`.toLowerCase().includes(query));
  }), [category, menu, search]);

  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);
  const cartTotal = cart.reduce((total, line) => total + line.item.price * line.quantity, 0);
  const availablePrices = menu.filter((item) => item.available).map((item) => item.price);

  const changeQuantity = (item: MenuItem, change: number) => {
    setCart((current) => {
      const existing = current.find((line) => line.item.id === item.id);
      if (!existing && change > 0) return [...current, { item, quantity: change }];
      return current
        .map((line) => line.item.id === item.id ? { ...line, quantity: line.quantity + change } : line)
        .filter((line) => line.quantity > 0);
    });
  };

  const goToSection = (id: string) => {
    setCartOpen(false);
    setView('menu');
    setPendingScroll(id);
  };

  const browseCategory = (name: MenuCategory) => {
    setCategory(name);
    setSearch('');
    goToSection('menu');
  };

  const openStaff = () => {
    setCartOpen(false);
    setMessage('');
    setView('staff');
    window.scrollTo({ top: 0 });
  };

  const selectNavItem = (id: string) => {
    if (id === 'order') setCartOpen(true);
    else if (id === 'staff') openStaff();
    else goToSection(id);
  };

  const navItems: FloatingNavItem[] = [
    { id: 'top', icon: <Home size={21} />, label: 'Home' },
    { id: 'menu', icon: <Coffee size={21} />, label: 'Menu' },
    { id: 'track', icon: <Search size={21} />, label: 'Track' },
    { id: 'visit', icon: <MapPin size={21} />, label: 'Visit' },
    { id: 'order', icon: <ShoppingBag size={21} />, label: 'Order', badge: cartCount },
    { id: 'staff', icon: <LockKeyhole size={21} />, label: 'Staff' },
  ];
  const activeNavItem = cartOpen ? 'order' : view === 'staff' ? 'staff' : activeSection;

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

  const brand = (
    <span className="brand-name">DAYBREAK<small>COFFEE</small></span>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <header className={view === 'menu' ? 'site-header over-hero' : 'site-header'}>
          <button className="brand" onClick={() => goToSection('top')} aria-label="Daybreak Coffee, go to the top of the shop page">{brand}</button>
        </header>

        {message && (
          <div className="toast" role="alert">
            <span>{message}</span><button aria-label="Dismiss message" onClick={() => setMessage('')}><X size={17} /></button>
          </div>
        )}

        {view === 'menu' ? (
          <>
            <main>
              <section id="top" className="hero">
                <img className="hero-photo" src="/images/hero-cafe.jpg" alt="Inside a warmly lit coffee shop, with the counter and espresso machines" width={1800} height={1100} fetchPriority="high" />
                <div className="hero-shade" />
                <motion.div className="hero-copy" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
                  <div className="eyebrow">SPECIALTY COFFEE &nbsp;•&nbsp; MASERU, LESOTHO</div>
                  <h1>Good things<br />are <em>brewing.</em></h1>
                  <p>Thoughtful coffee, fresh-from-the-oven treats, and a warm welcome. Made slowly, enjoyed whenever.</p>
                  <div className="hero-actions">
                    <div className="hero-buttons">
                      <button className="pill-button dark" onClick={() => goToSection('menu')}>Explore menu <ArrowRight size={17} /></button>
                      <button className="pill-button" onClick={() => goToSection('menu')}>Order now</button>
                    </div>
                    <button className="ghost-link" onClick={() => goToSection('track')}><span><Search size={16} /></span> Track an order</button>
                  </div>
                  <dl className="hero-stats">
                    <div><dt>On the menu</dt><dd>{menu.length || '—'}</dd></div>
                    <div><dt>Coffee and treats from</dt><dd>{availablePrices.length ? money(Math.min(...availablePrices)) : '—'}</dd></div>
                    <div><dt>Open every day</dt><dd>7am – 4pm</dd></div>
                  </dl>
                </motion.div>
                <p className="hero-script">Good mornings<br />start here</p>
              </section>

              {receipt && (
                <section className="receipt-banner" aria-live="polite" ref={receiptRef}>
                  <span className="receipt-icon"><BadgeCheck size={24} /></span>
                  <div><small>ORDER CONFIRMED</small><h2>You're on our list.</h2><p>Order <b>#{receipt.id}</b> · {money(receipt.total)} · We'll get right to it.</p></div>
                  <div className="receipt-status"><span className="status-dot pending" /> {receipt.status}</div>
                  <button className="icon-button" aria-label="Dismiss order confirmation" onClick={() => setReceipt(null)}><X size={19} /></button>
                </section>
              )}

              <section id="menu" className="menu-section">
                <div className="section-heading">
                  <Reveal><div className="eyebrow">OUR MENU</div><h2>Today's favourites.</h2></Reveal>
                  <Reveal className="menu-aside" delay={0.1}><p>Small batch. Big heart. Always made fresh, and priced in maloti.</p><button className="outline-button" onClick={() => setCartOpen(true)}>View your order <ArrowRight size={16} /></button></Reveal>
                </div>
                <div className="menu-toolbar">
                  <div className="category-tabs" role="group" aria-label="Menu categories">
                    {categories.map((name) => <button key={name} aria-pressed={category === name} className={category === name ? 'category-tab selected' : 'category-tab'} onClick={() => setCategory(name)}>{name}</button>)}
                  </div>
                  <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find your favourite" aria-label="Search the menu" /></label>
                </div>
                {menuLoading ? <div className="empty-state"><span className="loader" /> Loading today's menu...</div> : (
                  <div className="menu-grid">
                    {visibleMenu.map((item) => {
                      const inCart = cart.find((line) => line.item.id === item.id)?.quantity ?? 0;
                      return (
                        <motion.article
                          className={item.available ? 'menu-card' : 'menu-card unavailable'}
                          key={item.id}
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.45, ease: 'easeOut' }}
                        >
                          <img src={photoFor(item)} alt="" loading="lazy" width={720} height={900} />
                          {!item.available && <span className="card-chip sold-out">SOLD OUT TODAY</span>}
                          {item.available && inCart > 0 && <span className="card-chip in-cart"><Check size={13} /> {inCart} IN YOUR ORDER</span>}
                          <div className="card-body">
                            <span className="card-category">{item.category.toUpperCase()}</span>
                            <h3>{item.name}</h3>
                            <p>{item.description}</p>
                            <div className="card-foot">
                              <strong>{money(item.price)}</strong>
                              <button className="add-button" disabled={!item.available} aria-label={`Add ${item.name} to your order`} onClick={() => changeQuantity(item, 1)}><Plus size={20} /></button>
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                )}
                {!menuLoading && visibleMenu.length === 0 && <div className="empty-state">Nothing on the menu matches that just yet.</div>}
              </section>

              <section id="our-story" className="story-band">
                <Reveal className="story-copy">
                  <div className="eyebrow">OUR STORY</div>
                  <h2>A seat at<br />our table.</h2>
                  <p>We believe the best part of the day can be the simplest one. Good beans, kind people, and nowhere else you need to be.</p>
                  <button className="outline-button light" onClick={() => goToSection('visit')}>Come say hello <ArrowRight size={16} /></button>
                </Reveal>
                <img className="story-photo" src="/images/story-table.jpg" alt="A latte on a cafe table beside an open book" loading="lazy" width={1100} height={800} />
                <div className="story-side"><span>SLOW<br />MORNINGS<br />SECOND<br />CUPS</span><i /><em>Always<br />welcome.</em></div>
              </section>

              <section className="why-section">
                <Reveal className="why-heading"><h2>Why people stay.</h2><p>There is no secret to it. We make things properly and we are glad to see you.</p></Reveal>
                <div className="why-grid">
                  {reasons.map((reason, index) => (
                    <Reveal className="why-card" key={reason.title} delay={index * 0.08}>
                      <img src={`/images/${reason.photo}.jpg`} alt="" loading="lazy" width={1100} height={800} />
                      <div><h3>{reason.title}</h3><p>{reason.text}</p><button className="pill-button brown" onClick={() => browseCategory(reason.category)}>{reason.action}</button></div>
                    </Reveal>
                  ))}
                </div>
              </section>

              <section id="track" className="track-band">
                <div className="track-copy">
                  <p className="script">Already ordered?</p>
                  <h2>Follow your coffee.</h2>
                  <p>Pop in your order number and see what's happening.</p>
                  <form className="lookup-form" onSubmit={lookUpOrder}>
                    <label htmlFor="order-lookup">Order number</label>
                    <div><input id="order-lookup" value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="Paste your full order ID" required /><button className="pill-button" type="submit">Check status <ArrowRight size={16} /></button></div>
                    {lookupOrder && <span className="lookup-result"><span className={`status-dot ${lookupOrder.status.toLowerCase()}`} /> Order #{shortId(lookupOrder.id)} is <b>{lookupOrder.status}</b></span>}
                  </form>
                </div>
                <img className="track-photo" src="/images/beans.jpg" alt="" loading="lazy" width={720} height={900} />
              </section>

              <section id="visit" className="visit-section">
                <Reveal className="visit-copy">
                  <h2><em>Come visit us.</em></h2>
                  <p>Walk-ins, slow mornings, and second cups always welcome.</p>
                  <div className="visit-details">
                    <div><span>FIND OUR DOOR</span><p>Maseru, Lesotho</p></div>
                    <div><span>WHEN WE'RE HERE</span><p>Every day, 7:00 am – 4:00 pm</p></div>
                  </div>
                  <a className="pill-button brown" href="mailto:hello@daybreak.coffee">Say hello <ArrowUpRight size={16} /></a>
                </Reveal>
                <Reveal className="visit-photos" delay={0.1}>
                  <img src="/images/visit-bar.jpg" alt="A coffee bar with plants and hanging lights" loading="lazy" width={1100} height={800} />
                  <img src="/images/latte-croissants.jpg" alt="A latte beside a plate of croissants" loading="lazy" width={1100} height={800} />
                </Reveal>
              </section>

              <section className="promise-strip" aria-label="What we promise">
                {promises.map(({ icon: Icon, title, text }) => <div key={title}><Icon size={26} strokeWidth={1.5} /><p><b>{title}</b>{text}</p></div>)}
              </section>
            </main>
            <footer className="site-footer">
              <span className="footer-brand">{brand}</span>
              <p className="script">Good coffee, good company.</p>
              <span className="footer-note">© Daybreak Coffee 2026.</span>
            </footer>
          </>
        ) : (
          <main className="staff-page">
            <div className="staff-heading"><div><div className="eyebrow">BEHIND THE COUNTER</div><h1>Staff <em>dashboard.</em></h1><p>Keep the good things moving.</p></div><button className="text-link" onClick={() => goToSection('top')}><ArrowRight size={16} /> Back to the shop</button></div>
            {!staffReady ? (
              <form className="staff-login" onSubmit={signInStaff}><span className="login-icon"><LockKeyhole size={21} /></span><h2>Welcome back.</h2><p>Enter your staff access token to manage today's orders and menu.</p><label htmlFor="staff-token">Staff access token</label><input id="staff-token" type="password" autoComplete="current-password" value={staffToken} onChange={(event) => setStaffToken(event.target.value)} placeholder="Enter your token" required /><button className="pill-button dark" disabled={staffBusy}>{staffBusy ? 'Checking...' : 'Open dashboard'} <ArrowRight size={16} /></button></form>
            ) : (
              <>
                <div className="summary-grid">
                  <div className="summary-card"><span>TODAY'S ORDERS</span><strong>{summary?.orderCount ?? 0}</strong><small><Users size={15} /> Across all statuses</small></div>
                  <div className="summary-card"><span>TODAY'S SALES</span><strong>{money(summary?.revenue ?? 0)}</strong><small><BadgeCheck size={15} /> Confirmed order total</small></div>
                  <div className="summary-card"><span>IN PROGRESS</span><strong>{(summary?.byStatus.Pending ?? 0) + (summary?.byStatus.Preparing ?? 0)}</strong><small><Clock3 size={15} /> Pending + preparing</small></div>
                  <div className="summary-card summary-date"><span>REPORTING DATE</span><strong>{summary ? new Date(`${summary.date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}</strong><small>Daily overview</small></div>
                </div>
                <div className="staff-tabs"><button className={activeStaffTab === 'orders' ? 'staff-tab selected' : 'staff-tab'} onClick={() => setActiveStaffTab('orders')}>Orders <span>{staffOrders.length}</span></button><button className={activeStaffTab === 'menu' ? 'staff-tab selected' : 'staff-tab'} onClick={() => setActiveStaffTab('menu')}>Menu management</button><button className="staff-refresh" onClick={() => void refreshStaff()}><ArrowDown size={15} /> Refresh</button></div>
                {activeStaffTab === 'orders' ? <section className="staff-orders">
                  {staffOrders.length === 0 ? <div className="staff-empty"><Coffee size={26} /><h3>Nothing brewing just yet.</h3><p>New customer orders will show up here.</p></div> : staffOrders.map((order) => (
                    <article className="staff-order" key={order.id}>
                      <div className="staff-order-main"><span className="staff-order-id">#{shortId(order.id)} <span className={`status-pill ${order.status.toLowerCase()}`}>{order.status}</span></span><h3>{order.customerName}</h3><p>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ')}</p>{order.notes && <small>Note: {order.notes}</small>}</div>
                      <div className="staff-order-time"><Clock3 size={15} /> {prettyTime(order.createdAt)}</div><strong className="staff-order-total">{money(order.total)}</strong>
                      <label className="status-select"><span>Update status</span><select value={order.status} onChange={(event) => void updateStatus(order, event.target.value as OrderStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={16} /></label>
                    </article>
                  ))}
                </section> : (
                  <section className="menu-admin">
                    <form className="menu-editor" onSubmit={saveMenuItem}><div><div className="eyebrow">{editingItem ? 'EDIT ITEM' : 'ADD SOMETHING GOOD'}</div><h2>{editingItem ? 'Update your menu.' : 'New to the menu?'}</h2></div>
                      <label>Item name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={80} required /></label>
                      <label>Description<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={300} required /></label>
                      <div className="editor-row"><label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as MenuCategory })}>{categories.filter((value) => value !== 'All').map((value) => <option key={value}>{value}</option>)}</select></label><label>Price (M)<input type="number" value={draft.price || ''} min="0.01" max="1000" step="0.01" onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} required /></label></div>
                      <label className="availability-check"><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} /> Available to order</label>
                      <div className="editor-actions"><button className="pill-button dark" disabled={staffBusy}>{editingItem ? 'Save changes' : 'Add to menu'} <Plus size={16} /></button>{editingItem && <button type="button" className="text-link" onClick={() => { setEditingItem(null); setDraft(emptyDraft); }}>Cancel</button>}</div>
                    </form>
                    <div className="admin-items"><div className="eyebrow">CURRENT MENU · {menu.length} ITEMS</div>{menu.map((item) => <div className="admin-menu-item" key={item.id}><img src={photoFor(item)} alt="" loading="lazy" width={48} height={48} /><div><strong>{item.name}</strong><small>{item.category} · {money(item.price)} · {item.available ? 'Available' : 'Sold out'}</small></div><button className="icon-button" aria-label={`Edit ${item.name}`} onClick={() => { setEditingItem(item); setDraft({ name: item.name, description: item.description, category: item.category, price: item.price, available: item.available }); }}><Pencil size={17} /></button><button className="icon-button danger" aria-label={`Delete ${item.name}`} onClick={() => void removeMenuItem(item)}><Trash2 size={17} /></button></div>)}</div>
                  </section>
                )}
                <button className="sign-out" onClick={() => { setStaffReady(false); setStaffToken(''); setStaffOrders([]); setSummary(null); }}>Sign out of staff dashboard</button>
              </>
            )}
          </main>
        )}

        <FloatingNav items={navItems} active={activeNavItem} onSelect={selectNavItem} />

        {cartOpen && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <aside className="cart-drawer" aria-label="Your order">
            <div className="drawer-header"><div><div className="eyebrow">SOMETHING DELICIOUS</div><h2>Your <em>order.</em></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close your order"><X size={22} /></button></div>
            <div className="drawer-lines">
              {cart.length === 0 ? <div className="cart-empty"><UtensilsCrossed size={28} /><h3>Nothing here yet.</h3><p>Pick something lovely from the menu to get started.</p><button className="text-link" onClick={() => goToSection('menu')}>Explore the menu <ArrowRight size={16} /></button></div> : cart.map(({ item, quantity }) => <div className="cart-line" key={item.id}><img src={photoFor(item)} alt="" width={56} height={56} /><div className="cart-line-info"><strong>{item.name}</strong><span>{money(item.price)} each</span><div className="quantity-control"><button aria-label={`Remove one ${item.name}`} onClick={() => changeQuantity(item, -1)}><Minus size={14} /></button><b>{quantity}</b><button aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(item, 1)}><Plus size={14} /></button></div></div><strong className="cart-line-total">{money(item.price * quantity)}</strong></div>)}
            </div>
            {cart.length > 0 && <form className="checkout" onSubmit={placeOrder}><label htmlFor="customer-name">Your name</label><input id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="What should we call you?" maxLength={80} required /><label htmlFor="order-notes">Anything we should know? <span>OPTIONAL</span></label><textarea id="order-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Milk preference, a little extra cinnamon..." maxLength={300} rows={2} /><div className="checkout-total"><span>Total <small>{cartCount} {cartCount === 1 ? 'item' : 'items'}</small></span><strong>{money(cartTotal)}</strong></div><button className="pill-button dark checkout-button" disabled={placingOrder}>{placingOrder ? 'Placing your order...' : 'Place my order'} <ArrowRight size={17} /></button><p className="checkout-note"><Leaf size={13} /> Pay when you collect your order.</p></form>}
          </aside>
        </div>}
      </div>
    </MotionConfig>
  );
}
