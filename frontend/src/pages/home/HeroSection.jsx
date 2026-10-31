export default function HeroSection({ navigate }) {
  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.25s; }
        .delay-3 { animation-delay: 0.4s; }
        .delay-4 { animation-delay: 0.55s; }
      `}</style>

      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src="/img/background.png"
          alt="Academic Innovation"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(27,67,50,0.15) 0%, rgba(246,248,244,0.75) 100%)', backdropFilter: 'blur(6px)' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[1800px] 3xl:max-w-[2400px] 4xl:max-w-[3000px] mx-auto px-4 sm:px-6 md:px-12 py-12 sm:py-20 md:py-24">
        <div className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl">
          <span className="animate-fade-in-up delay-1 inline-block px-3 py-1 bg-[#1B4332]/10 text-[#1B4332] text-xs font-semibold rounded-sm mb-4 sm:mb-6 uppercase tracking-widest border border-[#1B4332]/20">
            Competition Portal
          </span>

          <h1
            className="animate-fade-in-up delay-2 text-3xl sm:text-4xl md:text-6xl 2xl:text-7xl font-bold text-[#14201A] mb-4 sm:mb-6 leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Smart-Evaluation: Smarter Judging. Faster Tabulation. Better Results.{' '}
         
          </h1>

          <p className="animate-fade-in-up delay-3 text-base sm:text-lg 2xl:text-xl text-[#4B5A4D] mb-8 sm:mb-10 max-w-2xl xl:max-w-3xl leading-relaxed">
          An AI-assisted web-based platform designed to streamline event judging, manage contestants, and automate score tabulation for school events.
          </p>

          <div className="animate-fade-in-up delay-4 flex flex-wrap gap-3 sm:gap-4">
            <button
              onClick={() => navigate('/school')}
              className="bg-[#1B4332] text-white px-6 sm:px-8 2xl:px-10 py-3 sm:py-4 2xl:py-5 rounded-sm text-xs sm:text-sm 2xl:text-base font-bold flex items-center gap-2 hover:bg-[#123024] transition-all tracking-wide"
            >
              Create School Account
              <span className="text-base sm:text-lg leading-none">→</span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="bg-white border border-[#1B4332]/30 text-[#1B4332] px-6 sm:px-8 2xl:px-10 py-3 sm:py-4 2xl:py-5 rounded-sm text-xs sm:text-sm 2xl:text-base font-bold hover:bg-[#F3F6F1] transition-all tracking-wide"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}