export default function Footer() {
  return (
    <footer className="border-t border-white/30 bg-white/20 backdrop-blur-xl py-24 px-6 md:px-24 mt-20">
      <div className="max-w-[1600px] mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-16">
        <div className="col-span-2 lg:col-span-2 flex flex-col gap-8">
          <div className="flex items-center gap-4 text-sand-900">
            <svg className="size-8 opacity-60" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 8C15.1634 8 8 15.1634 8 24C8 32.8366 15.1634 40 24 40C32.8366 40 40 32.8366 40 24C40 15.1634 32.8366 8 24 8ZM24 10C31.732 10 38 16.268 38 24C38 31.732 31.732 38 24 38C16.268 38 10 31.732 10 24C10 16.268 16.268 10 24 10Z" fill="currentColor"></path>
              <path d="M24 14C18.4772 14 14 18.4772 14 24C14 29.5228 18.4772 34 24 34C29.5228 34 34 29.5228 34 24C34 18.4772 29.5228 14 24 14ZM24 16C28.4183 16 32 19.5817 32 24C32 28.4183 28.4183 32 24 32C19.5817 32 16 28.4183 16 24C16 19.5817 19.5817 16 24 16Z" fill="currentColor" fillOpacity="0.5"></path>
              <path d="M24 20C21.7909 20 20 21.7909 20 24C20 26.2091 21.7909 28 24 28C26.2091 28 28 26.2091 28 24C28 21.7909 26.2091 20 24 20Z" fill="currentColor"></path>
            </svg>
            <span className="font-serif text-2xl tracking-wide font-light">Biscuit</span>
          </div>
          <p className="text-stone-500 font-light text-sm max-w-xs leading-loose tracking-wide">
            Making organizational knowledge accessible, accurate, and actionable through ethereal RAG technology.
          </p>
        </div>
        
        {/* Simplified Footer Columns */}
        <div className="flex flex-col gap-6">
          <h4 className="text-sand-900 font-semibold text-[10px] tracking-[0.25em] uppercase opacity-70">Access</h4>
          <a className="text-stone-500 hover:text-sand-900 transition-colors text-sm font-light tracking-wide" href="/login">Login</a>
        </div>
      </div>
    </footer>
  );
}
