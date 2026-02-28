import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex flex-col items-center px-6 md:px-24 py-12 w-full max-w-[1600px] mx-auto z-10 overflow-x-hidden">
        <section className="@container w-full relative">
          <div className="flex flex-col gap-12 py-8 lg:flex-row lg:items-center lg:gap-24 lg:py-16">
            <div className="flex flex-col gap-10 lg:w-1/2 relative z-10">
              <div className="flex flex-col gap-8 text-left">
                <h1 className="text-sand-900 text-6xl md:text-7xl lg:text-8xl font-thin leading-[1.1] tracking-tight font-serif">
                  Talk to your <br />
                  <span className="font-normal italic text-stone-600">knowledge.</span>
                </h1>
                <p className="text-stone-500 text-lg md:text-xl font-light leading-loose tracking-wide max-w-lg font-sans">
                  Transform static documents into fluid conversations. An ethereal interface for your data intelligence.
                </p>
              </div>
              <div className="flex flex-wrap gap-6 mt-6">
                <a href="/login" className="flex items-center justify-center rounded-full h-14 px-12 bg-stone-850 hover:bg-black text-pearl-50 text-xs uppercase tracking-[0.2em] font-medium transition-all shadow-levitate hover:shadow-xl hover:-translate-y-1">
                  Try for free
                </a>
              </div>
              <div className="flex items-center gap-6 text-xs text-stone-400 font-light mt-10 tracking-widest uppercase">
                <div className="flex -space-x-4">
                  <div className="w-12 h-12 rounded-full bg-stone-200 border border-white shadow-sm"></div>
                  <div className="w-12 h-12 rounded-full bg-stone-300 border border-white shadow-sm"></div>
                  <div className="w-12 h-12 rounded-full bg-stone-400 border border-white shadow-sm"></div>
                </div>
                <p>Used by forward-thinking teams</p>
              </div>
            </div>
            <div className="w-full lg:w-1/2 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-linear-to-tr from-white to-transparent rounded-full blur-3xl opacity-40"></div>
              <div className="relative w-full aspect-4/3 md:aspect-4/3 glass-card rounded-4xl p-4 shadow-levitate animate-float border border-white/60">
                <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative">
                  <div className="w-full h-full bg-cover bg-center opacity-80 mix-blend-multiply" style={{ backgroundImage: 'url("/images/p-13.jpg")', filter: 'sepia(0.1) contrast(0.95) brightness(1.05) grayscale(0.2)' }}></div>
                  <div className="absolute top-10 right-10 bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-float border border-white/40 flex flex-col gap-3 max-w-[200px] animate-float-delayed">
                    <div className="h-1.5 bg-stone-300/50 rounded-full w-3/4"></div>
                    <div className="h-1.5 bg-stone-200/50 rounded-full w-full"></div>
                    <div className="h-1.5 bg-stone-200/50 rounded-full w-1/2"></div>
                  </div>
                  <div className="absolute bottom-10 left-10 bg-white/80 backdrop-blur-2xl p-6 rounded-4xl shadow-levitate border border-white/50 flex items-center gap-5 pr-10 animate-float">
                    <div className="size-12 rounded-full bg-linear-to-tr from-stone-100 to-white border border-white flex items-center justify-center text-stone-500 shadow-sm">
                      <span className="material-symbols-outlined font-light text-[20px]">auto_awesome</span>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.2em] mb-1.5">Status</div>
                      <div className="text-sm font-light text-stone-800 tracking-wide font-serif italic">Analyzing Context</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-32 flex flex-col gap-24">
          <div className="flex flex-col gap-8 text-center items-center">
            <span className="px-5 py-2 rounded-full border border-sand-200/50 bg-white/30 backdrop-blur-sm text-stone-500 text-[10px] font-semibold tracking-[0.25em] uppercase shadow-sm">Ethereal Intelligence</span>
            <h2 className="text-sand-900 text-4xl md:text-6xl font-thin tracking-tight max-w-3xl font-serif">
              Seamless integration of <br /><span className="italic font-normal text-stone-600">mind and machine</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            <div className="glass-card group relative overflow-hidden rounded-[3rem] p-10 hover:bg-white/50 transition-all duration-700 hover:shadow-levitate shadow-float">
              <div className="mb-10 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white border border-white shadow-sm text-stone-600">
                <span className="material-symbols-outlined font-light text-[28px]">dataset</span>
              </div>
              <h3 className="mb-4 text-3xl font-light text-sand-900 font-serif">Smart Indexing</h3>
              <p className="text-stone-500 font-light leading-loose tracking-wide mb-10 text-sm">Effortlessly parse documents. We optimize context windows for pristine retrieval accuracy.</p>
              <div className="w-full h-40 bg-linear-to-b from-white/80 to-transparent rounded-2xl border border-white/60 overflow-hidden relative">
                <div className="absolute inset-x-8 top-8 h-px bg-stone-100"></div>
                <div className="absolute inset-x-8 top-16 h-px bg-stone-100"></div>
                <div className="absolute inset-x-8 top-24 h-px bg-stone-100"></div>
                <div className="absolute top-10 left-10 size-1.5 rounded-full bg-stone-300"></div>
                <div className="absolute top-11 left-14 h-0.5 w-12 rounded-full bg-stone-100"></div>
              </div>
            </div>
            <div className="glass-card group relative overflow-hidden rounded-[3rem] p-10 hover:bg-white/50 transition-all duration-700 hover:shadow-levitate shadow-float md:col-span-2">
              <div className="flex flex-col h-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                  <div className="max-w-md">
                    <div className="mb-10 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white border border-white shadow-sm text-stone-600">
                      <span className="material-symbols-outlined font-light text-[28px]">link</span>
                    </div>
                    <h3 className="mb-4 text-3xl font-light text-sand-900 font-serif">Instant Citations</h3>
                    <p className="text-stone-500 font-light leading-loose tracking-wide text-sm">Every answer flows from a source. Eliminate uncertainty with direct, clickable references to your truth.</p>
                  </div>
                </div>
                <div className="mt-auto pt-10 w-full">
                  <div className="w-full h-48 bg-white/30 backdrop-blur-md rounded-4xl border border-white/50 p-8 relative overflow-hidden flex flex-col justify-center gap-5 shadow-inner">
                    <div className="flex items-center gap-4">
                      <span className="size-1.5 bg-stone-400 rounded-full animate-pulse"></span>
                      <div className="h-1 w-1/4 bg-stone-300/30 rounded-full"></div>
                    </div>
                    <div className="flex gap-4">
                      <div className="px-5 py-3 bg-white/80 rounded-2xl shadow-sm border border-white text-stone-600 text-[11px] font-medium tracking-wide uppercase flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">description</span>
                        Q3 Report.pdf
                      </div>
                      <div className="px-5 py-3 bg-white/40 rounded-2xl border border-white/40 text-stone-400 text-[11px] font-medium tracking-wide uppercase">
                        Page 42
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-32 flex flex-col gap-24">
          <div className="flex flex-col gap-6 text-center items-center mb-20">
            <h2 className="text-sand-900 text-4xl md:text-6xl font-thin tracking-tight font-serif">Transparent pricing</h2>
            <p className="text-stone-500 text-lg font-light tracking-wide font-sans">Start lightly, scale infinitely.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl mx-auto items-center">
            <div className="flex flex-col gap-10 rounded-[3rem] bg-white/20 border border-white/40 p-12 hover:bg-white/40 transition-colors backdrop-blur-sm">
              <div>
                <h3 className="text-sand-900 text-xl font-normal mb-4 font-serif italic">Starter</h3>
                <p className="flex items-baseline gap-1 text-sand-900">
                  <span className="text-5xl font-thin tracking-tighter">$0</span>
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-widest ml-2">/mo</span>
                </p>
              </div>
              <div className="space-y-5">
                <div className="flex gap-4 text-sm text-stone-600 font-light items-center tracking-wide">
                  <span className="material-symbols-outlined text-stone-400 text-[18px]">check_circle</span>
                  100 documents
                </div>
                <div className="flex gap-4 text-sm text-stone-600 font-light items-center tracking-wide">
                  <span className="material-symbols-outlined text-stone-400 text-[18px]">check_circle</span>
                  Basic support
                </div>
                <div className="flex gap-4 text-sm text-stone-600 font-light items-center tracking-wide">
                  <span className="material-symbols-outlined text-stone-400 text-[18px]">check_circle</span>
                  Community access
                </div>
              </div>
              <a href="/login" className="flex items-center justify-center w-full py-5 rounded-full bg-white border border-stone-200 text-sand-900 text-xs font-medium uppercase tracking-[0.15em] hover:bg-stone-50 transition-colors shadow-md hover:shadow-lg">
                Start Free
              </a>
            </div>
            
            <div className="flex flex-col gap-10 rounded-[3rem] bg-white border border-stone-200 shadow-xl shadow-stone-900/5 p-14 relative z-10 transform md:scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-stone-850 text-white text-[9px] font-bold px-5 py-2 rounded-full uppercase tracking-[0.2em] shadow-lg">Most Popular</div>
              <div>
                <h3 className="text-sand-900 text-xl font-normal mb-4 font-serif italic">Pro</h3>
                <p className="flex items-baseline gap-1 text-sand-900">
                  <span className="text-6xl font-thin tracking-tighter">$49</span>
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-widest ml-2">/mo</span>
                </p>
              </div>
              <div className="space-y-5">
                <div className="flex gap-4 text-sm text-stone-800 font-normal items-center tracking-wide">
                  <span className="material-symbols-outlined text-stone-800 text-[18px]">check_circle</span>
                  Unlimited documents
                </div>
                <div className="flex gap-4 text-sm text-stone-800 font-normal items-center tracking-wide">
                  <span className="material-symbols-outlined text-stone-800 text-[18px]">check_circle</span>
                  Priority support
                </div>
                <div className="flex gap-4 text-sm text-stone-800 font-normal items-center tracking-wide">
                  <span className="material-symbols-outlined text-stone-800 text-[18px]">check_circle</span>
                  API access
                </div>
                <div className="flex gap-4 text-sm text-stone-800 font-normal items-center tracking-wide">
                  <span className="material-symbols-outlined text-stone-800 text-[18px]">check_circle</span>
                  Custom models
                </div>
              </div>
              <a href="/login" className="flex items-center justify-center w-full py-5 rounded-full bg-stone-900 text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-black transition-colors shadow-lg shadow-stone-900/10">
                Start Trial
              </a>
            </div>
            
            <div className="flex flex-col gap-10 rounded-[3rem] bg-white/20 border border-white/40 p-12 hover:bg-white/40 transition-colors backdrop-blur-sm">
              <div>
                <h3 className="text-sand-900 text-xl font-normal mb-4 font-serif italic">Enterprise</h3>
                <p className="flex items-baseline gap-1 text-sand-900">
                  <span className="text-5xl font-thin tracking-tighter">$199</span>
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-widest ml-2">/mo</span>
                </p>
              </div>
              <div className="space-y-5">
                <div className="flex gap-4 text-sm text-stone-600 font-light items-center tracking-wide">
                  <span className="material-symbols-outlined text-stone-400 text-[18px]">check_circle</span>
                  Dedicated instance
                </div>
                <div className="flex gap-4 text-sm text-stone-600 font-light items-center tracking-wide">
                  <span className="material-symbols-outlined text-stone-400 text-[18px]">check_circle</span>
                  SLA & Support
                </div>
                <div className="flex gap-4 text-sm text-stone-600 font-light items-center tracking-wide">
                  <span className="material-symbols-outlined text-stone-400 text-[18px]">check_circle</span>
                  SSO / SAML
                </div>
              </div>
              <a href="/login" className="flex items-center justify-center w-full py-5 rounded-full bg-white border border-stone-200 text-sand-900 text-xs font-medium uppercase tracking-[0.15em] hover:bg-stone-50 transition-colors shadow-md hover:shadow-lg">
                Contact Sales
              </a>
            </div>
          </div>
        </section>

        <section className="w-full py-20 px-4">
          <div className="w-full bg-stone-900 rounded-[3rem] md:rounded-[4rem] p-8 md:p-32 text-center relative overflow-hidden shadow-2xl shadow-stone-900/10">
            {/* Ambient blobs — clipped by overflow-hidden so they never scroll */}
            <div className="absolute top-0 right-0 w-80 h-80 md:w-[500px] md:h-[500px] bg-stone-800/50 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 md:w-[500px] md:h-[500px] bg-stone-700/40 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
            <div className="relative z-10 flex flex-col items-center gap-8 md:gap-10">
              <h2 className="text-pearl-50 text-4xl md:text-7xl font-thin tracking-tight max-w-4xl leading-tight font-serif">
                Ready to chat with your docs?
              </h2>
              <p className="text-stone-400 text-base md:text-xl font-light max-w-sm md:max-w-lg tracking-wide leading-relaxed">
                Get early access today. No credit card required.
              </p>
              {/* Email CTA — stacked card on mobile, pill row on desktop */}
              <div className="w-full max-w-md mt-4">
                <div className="flex flex-col gap-3 bg-white/5 backdrop-blur-md rounded-3xl md:rounded-full border border-white/10 p-3 shadow-2xl">
                  <input
                    className="w-full bg-transparent border-none outline-none text-white px-5 py-3 placeholder-stone-500 font-light text-sm tracking-wide rounded-2xl"
                    placeholder="Enter your email"
                    type="email"
                  />
                  <a
                    href="/login"
                    className="flex items-center justify-center w-full bg-white hover:bg-stone-100 text-stone-900 px-8 py-4 rounded-2xl md:rounded-full text-xs font-medium uppercase tracking-[0.15em] transition-all"
                  >
                    Get Early Access
                  </a>
                </div>
                <p className="text-stone-600 text-[10px] mt-4 font-light tracking-[0.2em] uppercase">No credit card · Cancel anytime</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
