export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-white/10 bg-pearl-50/60 backdrop-blur-xl px-6 lg:px-24 py-8 transition-all">
      <div className="flex items-center gap-4">
        <div className="size-8 text-sand-900/90">
          <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 8C15.1634 8 8 15.1634 8 24C8 32.8366 15.1634 40 24 40C32.8366 40 40 32.8366 40 24C40 15.1634 32.8366 8 24 8ZM24 10C31.732 10 38 16.268 38 24C38 31.732 31.732 38 24 38C16.268 38 10 31.732 10 24C10 16.268 16.268 10 24 10Z" fill="currentColor" fillOpacity="0.1"></path>
            <path d="M24 14C18.4772 14 14 18.4772 14 24C14 29.5228 18.4772 34 24 34C29.5228 34 34 29.5228 34 24C34 18.4772 29.5228 14 24 14ZM24 16C28.4183 16 32 19.5817 32 24C32 28.4183 28.4183 32 24 32C19.5817 32 16 28.4183 16 24C16 19.5817 19.5817 16 24 16Z" fill="currentColor" fillOpacity="0.2"></path>
            <path d="M24 20C21.7909 20 20 21.7909 20 24C20 26.2091 21.7909 28 24 28C26.2091 28 28 26.2091 28 24C28 21.7909 26.2091 20 24 20Z" fill="currentColor" fillOpacity="0.8"></path>
          </svg>
        </div>
        <h2 className="text-sand-900 text-2xl font-serif font-light tracking-wide">Biscuit</h2>
      </div>
      <div className="hidden md:flex flex-1 justify-end gap-12 items-center">
        <nav className="flex items-center gap-10">
          <a className="text-sand-900/50 hover:text-sand-900 transition-colors text-xs font-medium uppercase tracking-[0.2em]" href="/login">Login</a>
        </nav>
        <a href="/login" className="flex min-w-[120px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-11 px-7 glass-button hover:bg-white/40 transition-all text-sand-900 text-xs font-medium uppercase tracking-[0.15em] shadow-button hover:shadow-lg">
          <span className="truncate">Get Started</span>
        </a>
      </div>
      <div className="md:hidden flex items-center">
        <span className="material-symbols-outlined text-sand-900 cursor-pointer font-light">menu</span>
      </div>
    </header>
  )
}
