"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/chat");
    }
  }, [isLoading, isAuthenticated, router]);

  // Use the backend URL from the environment variable, falling back to localhost:3001
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const googleAuthUrl = `${API_URL}/auth/google`;

  if (isLoading || isAuthenticated) {
     return <div className="min-h-screen bg-pearl-50 flex items-center justify-center">
       <div className="size-8 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
     </div>;
  }

  return (
    <div className="min-h-screen bg-pearl-50 flex overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuCLk_Evsx_DCRFNCi7dx_Mp8la_QFvFn9-ca2qxOsCCJzOzJEC5Q3YKnuSDpCLmuC8lH1HrYXqdtsJm9NAWaY2qYdeU4kdlfCFPrJApj5JGQ6Pp856bPXYjittVAemwH3LbnclYQG5tLtxQE-_OWFwNa8YvTaQFkdUeQqppgomUfB384nvww0abPC8X_AhY6isQulk-q67IuOIi_RxynP9NNmm4sSFdC0euF5T0F3fSWKEZDReROE1P9KVN_tXVC9LpZdRfexR6h96Q')] bg-cover bg-center opacity-5 mix-blend-multiply pointer-events-none"></div>

      {/* Left side panel with copy */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-stone-900 overflow-hidden flex-col justify-between p-12 lg:p-24 shadow-2xl z-10">
         <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay" style={{ backgroundImage: 'url("/images/p-13.jpg")' }}></div>
         <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-stone-800/60 rounded-full blur-[120px] -mr-40 -mt-40 pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-stone-700/40 rounded-full blur-[100px] -ml-20 -mb-20 pointer-events-none"></div>
         
         <div className="relative z-10 flex items-center gap-4 text-pearl-50">
           <svg className="size-8" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
             <path d="M24 8C15.1634 8 8 15.1634 8 24C8 32.8366 15.1634 40 24 40C32.8366 40 40 32.8366 40 24C40 15.1634 32.8366 8 24 8ZM24 10C31.732 10 38 16.268 38 24C38 31.732 31.732 38 24 38C16.268 38 10 31.732 10 24C10 16.268 16.268 10 24 10Z" fill="currentColor"></path>
             <path d="M24 14C18.4772 14 14 18.4772 14 24C14 29.5228 18.4772 34 24 34C29.5228 34 34 29.5228 34 24C34 18.4772 29.5228 14 24 14ZM24 16C28.4183 16 32 19.5817 32 24C32 28.4183 28.4183 32 24 32C19.5817 32 16 28.4183 16 24C16 19.5817 19.5817 16 24 16Z" fill="currentColor" fillOpacity="0.5"></path>
             <path d="M24 20C21.7909 20 20 21.7909 20 24C20 26.2091 21.7909 28 24 28C26.2091 28 28 26.2091 28 24C28 21.7909 26.2091 20 24 20Z" fill="currentColor"></path>
           </svg>
           <span className="font-serif text-2xl tracking-wide font-light">Biscuit</span>
         </div>
         
         <div className="relative z-10 flex flex-col gap-8 max-w-lg mt-auto pb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-thin tracking-tight text-white font-serif leading-tight">
              Ethereal Intelligence for your workspace.
            </h1>
            <p className="text-stone-300 font-light text-lg leading-relaxed tracking-wide">
              Sync securely with Google Drive. Ask questions, extract insights, and rely on hyper-accurate citations mapped instantly to your truth.
            </p>
            <div className="flex items-center gap-4 mt-4">
               <div className="flex -space-x-3">
                 <div className="w-10 h-10 rounded-full bg-stone-500 border border-stone-800 shadow-sm"></div>
                 <div className="w-10 h-10 rounded-full bg-stone-600 border border-stone-800 shadow-sm"></div>
                 <div className="w-10 h-10 rounded-full bg-stone-700 border border-stone-800 shadow-sm"></div>
               </div>
               <span className="text-stone-400 text-xs font-medium uppercase tracking-[0.2em] ml-2">Join forward-thinking teams</span>
            </div>
         </div>
      </div>

      {/* Right side form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 lg:p-24 relative z-10 bg-pearl-50/80 backdrop-blur-xl">
        <Link href="/" className="absolute top-12 left-12 flex items-center gap-2 text-stone-500 hover:text-sand-900 transition-colors text-[10px] font-semibold uppercase tracking-[0.2em] group">
            <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
        </Link>
        
        <div className="w-full max-w-sm flex flex-col items-center text-center mt-12 lg:mt-0">
          <div className="lg:hidden flex items-center gap-3 text-sand-900 mb-12">
            <svg className="size-8 opacity-80" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 8C15.1634 8 8 15.1634 8 24C8 32.8366 15.1634 40 24 40C32.8366 40 40 32.8366 40 24C40 15.1634 32.8366 8 24 8ZM24 10C31.732 10 38 16.268 38 24C38 31.732 31.732 38 24 38C16.268 38 10 31.732 10 24C10 16.268 16.268 10 24 10Z" fill="currentColor"></path>
              <path d="M24 14C18.4772 14 14 18.4772 14 24C14 29.5228 18.4772 34 24 34C29.5228 34 34 29.5228 34 24C34 18.4772 29.5228 14 24 14ZM24 16C28.4183 16 32 19.5817 32 24C32 28.4183 28.4183 32 24 32C19.5817 32 16 28.4183 16 24C16 19.5817 19.5817 16 24 16Z" fill="currentColor" fillOpacity="0.5"></path>
              <path d="M24 20C21.7909 20 20 21.7909 20 24C20 26.2091 21.7909 28 24 28C26.2091 28 28 26.2091 28 24C28 21.7909 26.2091 20 24 20Z" fill="currentColor"></path>
            </svg>
            <span className="font-serif text-2xl tracking-wide font-light">Biscuit</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-thin tracking-tight text-sand-900 font-serif mb-4">
            Log in to your account
          </h2>
          <p className="text-stone-500 text-sm font-light tracking-wide mb-12 max-w-xs leading-loose">
            Securely access your semantic workspace and start talking to your data.
          </p>

          <a 
            href={googleAuthUrl}
            className="w-full flex items-center justify-center gap-4 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-full h-14 px-8 text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98] group"
          >
            <svg className="size-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <p className="mt-12 text-[11px] text-stone-400 font-light tracking-wide leading-loose">
            By continuing, you acknowledge that you have read and agree to our <br/>
            <a href="#" className="underline underline-offset-4 hover:text-stone-600 transition-colors">Terms of Service</a> and <a href="#" className="underline underline-offset-4 hover:text-stone-600 transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
