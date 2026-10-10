import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SignInModal from './SignInModal';

export default function Header({ navigate }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isMenuOpen]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
          isScrolled
            ? 'bg-white border-white/40 shadow-sm lg:bg-white/60 lg:backdrop-blur-md'
            : 'bg-[#FBFCF9]  '
        }`}
      >
        <div className="flex justify-between items-center max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[1800px] 3xl:max-w-[2400px] 4xl:max-w-[3000px] mx-auto px-4 sm:px-6 md:px-12 h-20">
          <div className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-[#1B4332] tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            <img
              src="/img/USAL_LOGO.png"
              alt="Veridict Logo"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0"
            />
            USAL
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => setIsSignInOpen(true)}
              className="text-base text-[#3C4A3E] hover:text-[#1B4332] transition-colors px-2 py-1 font-medium"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/school')}
              className="bg-[#1B4332] text-white px-6 py-2.5 rounded-sm text-sm font-bold hover:bg-[#123024] transition-all tracking-wide"
            >
              Get Started
            </button>
          </div>

          {/* Hamburger */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-[#3C4A3E] hover:text-[#1B4332] focus:outline-none p-2"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {isMenuOpen && (
          <div
            className={`md:hidden px-4 pt-2 pb-6 space-y-3 absolute left-0 w-full shadow-lg z-40 transition-all duration-200 ${
              isScrolled
                ? 'bg-white/70 backdrop-blur-md  border-white/40'
                : 'bg-[#FBFCF9]  border-[#1B4332]'
            }`}
          >
            <button
              onClick={() => { setIsMenuOpen(false); setIsSignInOpen(true); }}
              className="block w-full text-left text-base text-[#3C4A3E] hover:text-[#1B4332] font-medium py-2.5 border-b border-[#E1E8DE]"
            >
              Sign In
            </button>
            <button
              onClick={() => { navigate('/school'); setIsMenuOpen(false); }}
              className="block w-full text-center bg-[#1B4332] text-white py-3 rounded-sm text-sm font-bold hover:bg-[#123024] transition-all shadow-sm tracking-wide"
            >
              Get Started
            </button>
          </div>
        )}
      </nav>

      {/* Tap-outside overlay — closes the mobile menu when the page is tapped. */}
      {isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
          className="md:hidden fixed inset-0 z-40 bg-[#14201A]/45"
        />
      )}

      {createPortal(
        <SignInModal
          open={isSignInOpen}
          onClose={() => setIsSignInOpen(false)}
          navigate={navigate}
        />,
        document.body
      )}
    </>
  );
}