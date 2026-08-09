import React, { useState } from 'react';
import GlobalSearchBar from '../components/GlobalSearchBar';
import { Bike, Users, MapPin, Luggage, Star, ArrowRight, Navigation, Zap, HelpCircle, ChevronDown, ChevronUp, Mail, Phone, GraduationCap, ShieldCheck } from 'lucide-react';

export default function HomeView({ currentUser, setActiveTab, onLogAction, places = [], rentals = [], trips = [] }) {
  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Student';
  const [openFaqIndex, setOpenFaqIndex] = useState(0); // Open first FAQ by default

  const quickCards = [
    {
      id: 'rentals',
      title: 'Rent Vehicle',
      subtitle: 'Scooters, bikes & cars around campus',
      bgGradient: 'bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800',
      iconBg: 'bg-blue-400/30 text-white',
      icon: Bike,
      tab: 'rentals',
      badge: 'Self-Drive'
    },
    {
      id: 'travel',
      title: 'Find Travel Buddy',
      subtitle: 'Split cabs to airport, station & Panjim',
      bgGradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800',
      iconBg: 'bg-emerald-400/30 text-white',
      icon: Users,
      tab: 'travel',
      badge: 'Active Rides'
    },
    {
      id: 'explore',
      title: 'Explore Goa',
      subtitle: 'Student-picked beaches, cafes & waterfalls',
      bgGradient: 'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
      iconBg: 'bg-orange-400/30 text-white',
      icon: MapPin,
      tab: 'explore',
      badge: '10 Top Spots'
    },
    {
      id: 'planner',
      title: 'Trip Planner',
      subtitle: 'Generate custom itineraries & PDF travel guide',
      bgGradient: 'bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800',
      iconBg: 'bg-purple-400/30 text-white',
      icon: Luggage,
      tab: 'planner',
      badge: 'Smart PDF Guide'
    }
  ];

  const faqs = [
    {
      question: 'What is GoMove and what does it do?',
      answer: 'GoMove is the official all-in-one campus mobility and local exploration platform built for Goa Institute of Management (GIM). It connects students and campus vendors for seamless scooter/car rentals, enables instant cab-sharing to airports (MOPA & Dabolim) and railway stations, and provides student-curated Goa recommendations.'
    },
    {
      question: 'Why was GoMove built?',
      answer: 'We built GoMove to solve daily campus commute challenges around Sanquelim and Bicholim, significantly reduce travel costs through group cab sharing, eliminate middleman rental hassles, and help students discover the best hidden beaches, sunset spots, and cafes across Goa safely.'
    },
    {
      question: 'Who built this application?',
      answer: 'GoMove was proudly designed, architected, and engineered by students of the GIM PGDM 2027 Batch as part of our campus technology and product innovation initiative.'
    },
    {
      question: 'How do Vehicle Rentals & Payments work?',
      answer: 'Verified campus vendors list scooters (like Honda Activa 6G) and self-drive cars (like Honda City & Hyundai Verna). Students can browse, check live availability, and make instant secure bookings via Razorpay with automatic confirmation notifications.'
    },
    {
      question: 'How does Travel Buddy cab sharing work?',
      answer: 'Planning a trip to MOPA Airport, Dabolim Airport, or Thivim Railway Station? Simply post your departure date and available seats on the Travel Board or join an existing batchmate’s ride share to split cab fares effortlessly.'
    },
    {
      question: 'How can I contact support or get in touch?',
      answer: 'For support, vendor onboarding, or general queries, email us at gomove.support@gim.ac.in or call our student helpline at +91 98765 43210.'
    }
  ];

  const handleCardClick = (card) => {
    onLogAction('QUICK_CARD_CLICK', `Clicked homepage quick action card: ${card.title}`);
    setActiveTab(card.tab);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-12 py-6 space-y-8 pb-20">
      {/* Hero Banner with Global Search */}
      <div className="w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 md:p-10 text-white relative overflow-visible shadow-2xl z-20">
        {/* Decorative Background Effects (Clipped cleanly inside container) */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 -mb-16 w-[400px] h-[400px] rounded-full bg-indigo-500/20 blur-2xl" />
        </div>

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold backdrop-blur-md">
            <Zap className="w-3.5 h-3.5" />
            <span>GoMove • Campus Mobility & Exploration</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Where do you want to explore today, <span className="text-blue-400">{firstName}</span>?
          </h1>

          <p className="text-slate-300 text-xs md:text-base leading-relaxed max-w-2xl">
            Rent vehicles (Activa 6G, Honda City, Verna), split rides to Dabolim & Mopa Airport, and discover student-recommended beaches & cafes.
          </p>

          <div className="pt-2 max-w-2xl relative z-30">
            <GlobalSearchBar
              rentals={rentals}
              places={places}
              trips={trips}
              setActiveTab={setActiveTab}
              onLogAction={onLogAction}
            />
          </div>
        </div>
      </div>

      {/* 4 Quick Action Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-slate-900">
            Campus Quick Actions
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 md:gap-6">
          {quickCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => handleCardClick(card)}
                className={`group relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white text-left transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between h-44 sm:h-52 ${card.bgGradient}`}
              >
                {/* Header inside card */}
                <div className="flex items-center justify-between z-10 w-full">
                  <div className={`p-3 rounded-2xl backdrop-blur-md ${card.iconBg}`}>
                    <Icon className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <span className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] sm:text-xs font-bold border border-white/30 tracking-wide">
                    {card.badge}
                  </span>
                </div>

                <div className="z-10 mt-3 md:mt-4">
                  <h3 className="font-extrabold text-base md:text-xl leading-tight drop-shadow-sm">{card.title}</h3>
                  <p className="text-[11px] md:text-xs font-medium text-white/85 mt-1 leading-snug">{card.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>



      {/* Frequently Asked Questions (FAQs) Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-10 shadow-lg space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-xs font-extrabold text-blue-600">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Campus Guide & Information</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">Frequently Asked Questions</h2>
            <p className="text-xs md:text-sm font-medium text-slate-500">
              Everything you need to know about GoMove, our creators, and campus mobility support
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/70 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Built By</p>
              <p className="text-xs font-black text-slate-800">GIM PGDM 2027 Batch</p>
            </div>
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? 'bg-blue-50/40 border-blue-200 shadow-sm'
                    : 'bg-slate-50/50 border-slate-200/70 hover:bg-slate-50'
                }`}
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 focus:outline-none"
                >
                  <span className="font-extrabold text-slate-900 text-sm md:text-base flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    {faq.question}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-blue-600 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs md:text-sm text-slate-600 font-medium leading-relaxed border-t border-blue-100/60 ml-8">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact Us Support Banner */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-5 text-white shadow-md">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-extrabold text-sm sm:text-base">Have more questions or need vendor support?</h4>
            <p className="text-xs text-blue-200">Our student team is here to assist you 24/7 on campus.</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <a
              href="mailto:gomove.support@gim.ac.in"
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-blue-300" />
              <span>gomove.support@gim.ac.in</span>
            </a>

            <a
              href="tel:+919876543210"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>+91 98765 43210</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
