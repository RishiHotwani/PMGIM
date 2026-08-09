import React, { useState } from 'react';
import { 
  Compass, MapPin, Calendar, Clock, Sparkles, ArrowRight, ArrowLeft, 
  Check, RefreshCw, Download, Info, ExternalLink, Filter, AlertTriangle, 
  Sliders, Coffee, DollarSign, Layers, ChevronRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import SpotDetailModal from '../components/SpotDetailModal';

export default function TripPlannerView({ places = [], onLogAction, currentUser, onToggleBookmark }) {
  // Wizard Input States
  const [step, setStep] = useState(1);
  const [area, setArea] = useState('Any'); // North Goa, South Goa, Both, Any
  const [duration, setDuration] = useState(2); // 1 to 5 days
  const [selectedInterests, setSelectedInterests] = useState(['Beaches', 'Food', 'Nightlife']);
  const [budget, setBudget] = useState('Moderate'); // Budget, Moderate, Premium, No Preference
  const [startLocation, setStartLocation] = useState('GIM Campus (Sanquelim)');
  const [startTime, setStartTime] = useState('09:00 AM');
  const [pace, setPace] = useState('Balanced'); // Relaxed, Balanced, Packed
  const [travelMode, setTravelMode] = useState('Rental Vehicle (Scooter/Car)');

  // Output Itinerary State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedItinerary, setGeneratedItinerary] = useState(null);
  const [selectedSpotModal, setSelectedSpotModal] = useState(null);

  // Available Interest Categories from current Explore Goa Data
  const availableInterestOptions = [
    { id: 'Beaches', label: 'Beaches & Lagoons', icon: '🏖️' },
    { id: 'Food', label: 'Cafes & Dining', icon: '🍴' },
    { id: 'Nightlife', label: 'Nightlife & Clubs', icon: '🎉' },
    { id: 'Waterfalls', label: 'Waterfalls & Nature', icon: '🌿' },
    { id: 'Shopping', label: 'History, Markets & Forts', icon: '🏛️' },
    { id: 'Water Sports', label: 'Water Sports & Cruises', icon: '🌊' }
  ];

  const handleInterestToggle = (interestId) => {
    if (selectedInterests.includes(interestId)) {
      if (selectedInterests.length > 1) {
        setSelectedInterests(selectedInterests.filter(i => i !== interestId));
      }
    } else {
      setSelectedInterests([...selectedInterests, interestId]);
    }
  };

  // Helper: Helper function to determine if place belongs to North or South Goa
  const isSouthGoaPlace = (place) => {
    const text = (place.name + ' ' + (place.description || '') + ' ' + (place.distance || '')).toLowerCase();
    return text.includes('south goa') || text.includes('palolem') || text.includes('cavelossim') || text.includes('verna springs') || text.includes('kesarval');
  };

  const isNorthGoaPlace = (place) => {
    return !isSouthGoaPlace(place);
  };

  // Deterministic Itinerary Generator Logic
  const handleGenerateItinerary = () => {
    setIsGenerating(true);
    if (onLogAction) {
      onLogAction('GENERATE_TRIP_PLAN', `Generated ${duration}-day plan for area: ${area}, budget: ${budget}`);
    }

    setTimeout(() => {
      // 1. Filter places by Area preference
      let filtered = [...places];
      if (area === 'North Goa') {
        filtered = filtered.filter(isNorthGoaPlace);
      } else if (area === 'South Goa') {
        filtered = filtered.filter(isSouthGoaPlace);
      }

      // 2. Filter / Score places by Interest Match
      const interestMatches = filtered.filter(p => {
        if (selectedInterests.includes('Beaches') && p.category === 'Beaches') return true;
        if (selectedInterests.includes('Food') && p.category === 'Food') return true;
        if (selectedInterests.includes('Nightlife') && p.category === 'Nightlife') return true;
        if (selectedInterests.includes('Waterfalls') && p.category === 'Waterfalls') return true;
        if (selectedInterests.includes('Shopping') && p.category === 'Shopping') return true;
        return selectedInterests.includes(p.category);
      });

      // If interest matching yields enough places, use them; otherwise broaden to full filtered pool
      const candidates = interestMatches.length >= duration * 2 ? interestMatches : (filtered.length > 0 ? filtered : places);

      // Sort by rating descending
      candidates.sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5));

      // Determine places per day based on pace
      const placesPerDay = pace === 'Relaxed' ? 2 : (pace === 'Packed' ? 4 : 3);
      const totalNeeded = duration * placesPerDay;

      // Select top candidate places without duplicates
      const selectedPlaces = candidates.slice(0, Math.min(totalNeeded, candidates.length));

      // Separate into North vs South clusters for day-wise distribution
      const northCluster = selectedPlaces.filter(isNorthGoaPlace);
      const southCluster = selectedPlaces.filter(isSouthGoaPlace);

      const daysList = [];
      let northIndex = 0;
      let southIndex = 0;

      // Base Start Time Calculation
      const startHour = parseInt(startTime.split(':')[0]) || 9;
      const isPM = startTime.toLowerCase().includes('pm');
      const baseHour24 = (isPM && startHour !== 12) ? startHour + 12 : (!isPM && startHour === 12 ? 0 : startHour);

      for (let dayNum = 1; dayNum <= duration; dayNum++) {
        // Decide region for this day to avoid crisscrossing
        let dayRegion = 'North Goa';
        let dayPlaces = [];

        if (area === 'South Goa' || (area === 'Both' && dayNum % 2 === 0 && southCluster.length > southIndex)) {
          dayRegion = 'South Goa';
          dayPlaces = southCluster.slice(southIndex, southIndex + placesPerDay);
          southIndex += dayPlaces.length;
        } else {
          dayRegion = 'North Goa';
          dayPlaces = northCluster.slice(northIndex, northIndex + placesPerDay);
          northIndex += dayPlaces.length;
        }

        // Fallback if cluster empty
        if (dayPlaces.length === 0) {
          const remaining = selectedPlaces.filter(p => !daysList.flatMap(d => d.schedule).map(s => s.place.id).includes(p.id));
          dayPlaces = remaining.slice(0, placesPerDay);
        }

        // Construct realistic daily time schedule
        let currentHour = baseHour24;
        let currentMinute = 0;

        const scheduleItems = dayPlaces.map((place, idx) => {
          // Format slot start time
          const startPeriod = currentHour >= 12 ? 'PM' : 'AM';
          const displayHour = currentHour % 12 === 0 ? 12 : currentHour % 12;
          const formattedStart = `${String(displayHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')} ${startPeriod}`;

          // Estimate visit duration (1.5h for food/beaches, 2h for waterfalls/forts)
          const durationMins = place.category === 'Food' ? 90 : (place.category === 'Waterfalls' ? 120 : 105);

          // Calculate end time
          let endMinuteTotal = currentHour * 60 + currentMinute + durationMins;
          let endHour = Math.floor(endMinuteTotal / 60);
          let endMinute = endMinuteTotal % 60;

          const endPeriod = endHour >= 12 ? 'PM' : 'AM';
          const displayEndHour = endHour % 12 === 0 ? 12 : endHour % 12;
          const formattedEnd = `${String(displayEndHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')} ${endPeriod}`;

          // Increment current time for next stop (add 30 min travel time)
          currentHour = Math.floor((endMinuteTotal + 30) / 60);
          currentMinute = (endMinuteTotal + 30) % 60;

          return {
            slot: `${formattedStart} – ${formattedEnd}`,
            place,
            activityType: idx === 0 ? 'Morning Exploration' : (place.category === 'Food' ? 'Lunch / Dining Spot' : (idx === dayPlaces.length - 1 ? 'Sunset & Night Experience' : 'Sightseeing Stop'))
          };
        });

        daysList.push({
          dayNumber: dayNum,
          region: dayRegion,
          schedule: scheduleItems
        });
      }

      setGeneratedItinerary({
        title: `${area === 'Any' ? 'Curated Goa' : area} Travel Itinerary`,
        duration: `${duration} Day${duration > 1 ? 's' : ''}`,
        area,
        budget,
        startLocation,
        startTime,
        interests: selectedInterests,
        totalPlacesCount: selectedPlaces.length,
        days: daysList
      });

      setIsGenerating(false);
      setStep(7); // Jump to Itinerary Results View
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 600);
  };

  // PDF Export Engine using jsPDF
  const handleExportPDF = () => {
    if (!generatedItinerary) return;

    if (onLogAction) {
      onLogAction('EXPORT_TRIP_PDF', `Exported PDF itinerary for ${generatedItinerary.title}`);
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;

    // Helper: Add Brand Header
    const addHeader = (pageNum) => {
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('GoMove', margin, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('GIM CAMPUS MOBILITY • INTERACTIVE GOA TRAVEL GUIDE', margin + 30, 14);

      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(`Page ${pageNum}`, pageWidth - margin - 12, 14);
    };

    // PAGE 1: Cover & Summary
    addHeader(1);
    yPos = 35;

    // Title Block
    doc.setFillColor(37, 99, 235); // blue-600
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 32, 4, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(generatedItinerary.title, margin + 8, yPos + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Duration: ${generatedItinerary.duration}  •  Start: ${generatedItinerary.startLocation} (${generatedItinerary.startTime})`, margin + 8, yPos + 22);

    yPos += 42;

    // Trip Overview Metadata Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 35, 3, 3, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TRIP OVERVIEW & PREFERENCES', margin + 6, yPos + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);

    doc.text(`• Region / Area: ${generatedItinerary.area}`, margin + 6, yPos + 16);
    doc.text(`• Budget Preference: ${generatedItinerary.budget}`, margin + 6, yPos + 22);
    doc.text(`• Starting Point: ${generatedItinerary.startLocation}`, margin + 6, yPos + 28);

    doc.text(`• Total Destinations: ${generatedItinerary.totalPlacesCount} Places`, margin + 100, yPos + 16);
    doc.text(`• Interests: ${generatedItinerary.interests.join(', ')}`, margin + 100, yPos + 22);
    doc.text(`• Created For: GIM PGDM 2027 Student Exploration`, margin + 100, yPos + 28);

    yPos += 45;

    // Render Days
    let currentPage = 1;

    generatedItinerary.days.forEach((day) => {
      // Check space for day header
      if (yPos > pageHeight - 40) {
        doc.addPage();
        currentPage++;
        addHeader(currentPage);
        yPos = 32;
      }

      // Day Section Header
      doc.setFillColor(30, 41, 59); // slate-800
      doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`DAY ${day.dayNumber} — ${day.region.toUpperCase()}`, margin + 6, yPos + 7);

      yPos += 15;

      day.schedule.forEach((item) => {
        const place = item.place;

        // Check if card fits on page
        if (yPos > pageHeight - 50) {
          doc.addPage();
          currentPage++;
          addHeader(currentPage);
          yPos = 32;
        }

        // Place Card Frame
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 42, 3, 3, 'FD');

        // Left Time Pill
        doc.setFillColor(239, 246, 255); // blue-50
        doc.roundedRect(margin + 3, yPos + 3, 40, 8, 2, 2, 'F');
        doc.setTextColor(29, 78, 216); // blue-700
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(item.slot, margin + 5, yPos + 8);

        // Category Badge
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin + 46, yPos + 3, 26, 8, 2, 2, 'F');
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.text(place.category, margin + 48, yPos + 8);

        // Place Title
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(place.name, margin + 5, yPos + 18);

        // Details (Distance & Price)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`${place.distance}   |   Est. Cost: ${place.price || 'Free'}   |   Rating: ${place.rating} / 5`, margin + 5, yPos + 24);

        // Short Description
        const descText = place.description ? (place.description.length > 110 ? place.description.substring(0, 110) + '...' : place.description) : '';
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(8.5);
        doc.text(descText, margin + 5, yPos + 30);

        // Clickable Navigation Link
        const mapsUrl = place.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' Goa')}`;
        doc.setTextColor(37, 99, 235); // blue-600
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.textWithLink('📍 Open in Google Maps', margin + 5, yPos + 37, { url: mapsUrl });

        yPos += 47;
      });

      yPos += 5;
    });

    // Footer Branding
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Generated by GoMove • Campus Mobility & Exploration Platform for GIM PGDM 2027', margin, pageHeight - 8);

    doc.save(`GoMove_Travel_Plan_${generatedItinerary.area.replace(/\s+/g, '_')}_${generatedItinerary.duration.replace(/\s+/g, '_')}.pdf`);
  };

  const getMapsUrl = (spot) => {
    if (spot.maps_url) return spot.maps_url;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' Goa')}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header Hero Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-extrabold text-blue-300 backdrop-blur-md">
            <Compass className="w-4 h-4 text-blue-400" />
            <span>GoMove Smart Itinerary Generator</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Goa <span className="text-blue-400">Trip Planner</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
            Tell GoMove your preferences — get a practical day-by-day Goa itinerary with interactive Google Maps links & downloadable PDF guide.
          </p>
        </div>

        {step <= 6 && (
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl text-center shrink-0 space-y-1">
            <span className="text-xs font-extrabold text-blue-300 block uppercase tracking-wider">Step {step} of 6</span>
            <div className="w-28 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${(step / 6) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ─── WIZARD FORM STEPS ─────────────────────────────────── */}
      {step <= 6 && (
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xl space-y-8 transition-all">
          {/* STEP 1: DESTINATION / AREA */}
          {step === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">Step 1</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">Where do you want to explore?</h2>
                <p className="text-xs text-slate-500 font-medium">Select the region of Goa you wish to visit.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'North Goa', title: 'North Goa', desc: 'Baga, Anjuna, Chapora Fort, Vagator, Panjim Fontainhas & Nightlife', icon: '🏖️' },
                  { id: 'South Goa', title: 'South Goa', desc: 'Palolem, Cavelossim, Verna Springs & Serene White Sand Bays', icon: '🌴' },
                  { id: 'Both', title: 'Both North & South Goa', desc: 'Complete state tour covering beaches, heritage, spice farms & waterfalls', icon: '🗺️' },
                  { id: 'Any', title: 'Any / Let GoMove Decide', desc: 'Best student recommendations curated based on rating & route proximity', icon: '✨' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setArea(opt.id)}
                    className={`p-5 rounded-2xl text-left border-2 transition-all flex items-start gap-4 ${
                      area === opt.id
                        ? 'border-blue-600 bg-blue-50/70 shadow-md shadow-blue-500/10'
                        : 'border-slate-100 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <span className="text-3xl shrink-0">{opt.icon}</span>
                    <div className="space-y-1">
                      <span className="font-extrabold text-slate-900 text-sm block">{opt.title}</span>
                      <span className="text-xs text-slate-500 block font-medium leading-relaxed">{opt.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: TRIP DURATION */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">Step 2</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">How many days do you have?</h2>
                <p className="text-xs text-slate-500 font-medium">Select your total trip duration.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => setDuration(num)}
                    className={`py-5 px-4 rounded-2xl text-center border-2 transition-all space-y-1 ${
                      duration === num
                        ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'border-slate-200 hover:border-blue-300 bg-white text-slate-800'
                    }`}
                  >
                    <span className="text-2xl font-black block">{num}</span>
                    <span className="text-xs font-extrabold uppercase tracking-wider block">{num === 1 ? 'Day Trip' : 'Days'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: INTERESTS */}
          {step === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">Step 3</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">What are you interested in?</h2>
                <p className="text-xs text-slate-500 font-medium">Select multiple interests to personalize your itinerary.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableInterestOptions.map((opt) => {
                  const isSelected = selectedInterests.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleInterestToggle(opt.id)}
                      className={`p-4 rounded-2xl text-left border-2 transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-extrabold shadow-sm'
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50 text-slate-700 font-bold'
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="text-xs font-extrabold">{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 ml-auto text-blue-600 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: BUDGET */}
          {step === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">Step 4</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">What is your approximate budget?</h2>
                <p className="text-xs text-slate-500 font-medium">Filter places according to expected cost.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'Budget', title: 'Student Budget (₹)', desc: 'Free entry forts, natural waterfalls, public beaches & affordable shacks (Under ₹500/day)', icon: '🏷️' },
                  { id: 'Moderate', title: 'Moderate (₹₹)', desc: 'Water sports, entry fee spots, beach shacks & mid-range cafes (₹500 – ₹1500/day)', icon: '💳' },
                  { id: 'Premium', title: 'Premium (₹₹₹)', desc: 'Scuba diving, luxury casino cruises, fine dining & upscale clubs (₹1500+/day)', icon: '💎' },
                  { id: 'No Preference', title: 'No Preference', desc: 'Include a balanced mix of all student-favorite places across budget ranges', icon: '⚖️' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setBudget(opt.id)}
                    className={`p-5 rounded-2xl text-left border-2 transition-all flex items-start gap-4 ${
                      budget === opt.id
                        ? 'border-blue-600 bg-blue-50/70 shadow-md shadow-blue-500/10'
                        : 'border-slate-100 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <span className="text-3xl shrink-0">{opt.icon}</span>
                    <div className="space-y-1">
                      <span className="font-extrabold text-slate-900 text-sm block">{opt.title}</span>
                      <span className="text-xs text-slate-500 block font-medium leading-relaxed">{opt.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: STARTING LOCATION */}
          {step === 5 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">Step 5</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">Where will you start your trip?</h2>
                <p className="text-xs text-slate-500 font-medium">Select your pickup or departure point.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  'GIM Campus (Sanquelim)',
                  'Goa MOPA Airport (GOX)',
                  'Dabolim Airport (GOI)',
                  'Thivim / Madgaon Railway Station',
                  'North Goa (Panjim / Baga)',
                  'South Goa (Margao)'
                ].map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setStartLocation(loc)}
                    className={`p-4 rounded-2xl text-left border-2 transition-all flex items-center gap-3 ${
                      startLocation === loc
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-extrabold shadow-sm'
                        : 'border-slate-100 hover:border-slate-200 bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
                    <span className="text-xs font-extrabold">{loc}</span>
                    {startLocation === loc && <Check className="w-4 h-4 ml-auto text-blue-600 stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: START TIME & PACE */}
          {step === 6 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">Step 6</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">Timing & Pace Preferences</h2>
                <p className="text-xs text-slate-500 font-medium">Finalize your start time and daily exploration speed.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Daily Start Time:</label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setStartTime(t)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 ${
                          startTime === t
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Exploration Pace:</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'Relaxed', label: 'Relaxed', desc: '2 stops / day' },
                      { id: 'Balanced', label: 'Balanced', desc: '3 stops / day' },
                      { id: 'Packed', label: 'Packed', desc: '4 stops / day' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPace(p.id)}
                        className={`p-3 rounded-2xl text-center border-2 transition-all space-y-0.5 ${
                          pace === p.id
                            ? 'border-blue-600 bg-blue-50 text-blue-900 font-extrabold'
                            : 'border-slate-100 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <span className="text-xs font-extrabold block">{p.label}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center gap-2 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 6 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all ml-auto"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleGenerateItinerary}
                disabled={isGenerating}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-black shadow-xl shadow-blue-500/30 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ml-auto"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Planning Your Goa Experience...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate My Goa Plan</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP 7: ITINERARY RESULTS & WEB DISPLAY ───────────── */}
      {step === 7 && generatedItinerary && (
        <div className="space-y-8 animate-fadeIn">
          {/* Action Bar Banner */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">Generated Plan</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">{generatedItinerary.title}</h2>
              <p className="text-xs text-slate-500 font-medium">
                {generatedItinerary.duration} • Starting from {generatedItinerary.startLocation} ({generatedItinerary.startTime})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center gap-2 transition-all"
              >
                <Sliders className="w-4 h-4" />
                <span>Modify Preferences</span>
              </button>

              <button
                onClick={handleExportPDF}
                className="px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-extrabold shadow-md flex items-center gap-2 transition-all hover:scale-105"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>Download PDF Guide</span>
              </button>
            </div>
          </div>

          {/* Days Timeline View */}
          <div className="space-y-8">
            {generatedItinerary.days.map((day) => (
              <div key={day.dayNumber} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-lg space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                      D{day.dayNumber}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">DAY {day.dayNumber} — {day.region}</h3>
                      <span className="text-xs text-slate-500 font-medium">{day.schedule.length} Destinations Scheduled</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 relative before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
                  {day.schedule.map((item, idx) => {
                    const spot = item.place;
                    return (
                      <div key={spot.id} className="relative pl-12 group">
                        {/* Timeline Node */}
                        <div className="absolute left-3 top-6 -translate-x-1/2 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100 group-hover:scale-125 transition-transform" />

                        <div className="bg-slate-50/70 hover:bg-white rounded-3xl p-5 border border-slate-200/70 hover:border-blue-200 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                            <img
                              src={spot.image}
                              alt={spot.name}
                              className="w-full sm:w-28 h-24 rounded-2xl object-cover shrink-0 shadow-sm"
                            />
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-extrabold">
                                  {item.slot}
                                </span>
                                <span className="px-2.5 py-1 bg-slate-200/80 text-slate-700 rounded-lg text-[10px] font-bold">
                                  {spot.category}
                                </span>
                                <span className="text-[11px] font-extrabold text-amber-500 flex items-center gap-0.5">
                                  ★ {spot.rating}
                                </span>
                              </div>

                              <h4 className="font-black text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                                {spot.name}
                              </h4>
                              <p className="text-xs text-slate-500 font-medium line-clamp-2 max-w-xl">
                                {spot.description}
                              </p>
                              {spot.pro_tips && (
                                <p className="text-[11px] text-indigo-600 font-extrabold">
                                  💡 Tip: {spot.pro_tips}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200">
                            <button
                              onClick={() => setSelectedSpotModal(spot)}
                              className="py-2.5 px-4 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span>View Details</span>
                            </button>

                            <a
                              href={getMapsUrl(spot)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2.5 px-4 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-blue-200"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>Navigate</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Action Footer */}
          <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black">Ready to explore Goa?</h3>
              <p className="text-xs text-slate-400 font-medium">
                Download your interactive PDF guide to access navigation links on the go.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportPDF}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all hover:scale-105"
              >
                <Download className="w-4 h-4" />
                <span>Download Interactive PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spot Detail Modal Integration */}
      {selectedSpotModal && (
        <SpotDetailModal
          spot={selectedSpotModal}
          onClose={() => setSelectedSpotModal(null)}
          currentUser={currentUser}
          onLogAction={onLogAction}
        />
      )}
    </div>
  );
}
