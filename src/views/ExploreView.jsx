import React, { useState, useEffect } from 'react';
import { MapPin, Star, Heart, Clock, DollarSign, Compass, MessageSquare, ExternalLink, Send, ShieldCheck, Sparkles, X, Info } from 'lucide-react';

export default function ExploreView({ places = [], onLogAction, onToggleBookmark, currentUser }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  
  // Rating & Comment Form State
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');

  const categories = ['All', 'Beaches', 'Waterfalls', 'Food', 'Forts', 'Nightlife'];

  const filteredPlaces = places.filter((item) => {
    if (selectedCategory === 'All') return true;
    return item.category === selectedCategory;
  });

  const fetchSpotReviews = async (spotId) => {
    setLoadingReviews(true);
    try {
      const res = await fetch(`/api/explore/${spotId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.error('Fetch reviews error:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleOpenSpot = (spot) => {
    setSelectedSpot(spot);
    setReviewMsg('');
    setNewRating(5);
    setNewComment('');
    fetchSpotReviews(spot.id);
    if (onLogAction) onLogAction('VIEW_EXPLORE_SPOT', `Opened details for spot: ${spot.name}`);
  };

  const handlePostReview = async (e) => {
    e.preventDefault();
    if (!selectedSpot || !newComment.trim()) return;

    setSubmittingReview(true);
    setReviewMsg('');

    try {
      const res = await fetch(`/api/explore/${selectedSpot.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-name': currentUser?.name || 'Student'
        },
        body: JSON.stringify({
          rating: newRating,
          comment: newComment,
          userName: currentUser?.name || 'GIM Student',
          userId: currentUser?.id || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit review');

      setReviewMsg('⭐ Thank you! Your review and rating have been posted.');
      setNewComment('');
      fetchSpotReviews(selectedSpot.id);

      if (onLogAction) {
        onLogAction('POST_SPOT_REVIEW', `Submitted ${newRating}-star review for ${selectedSpot.name}`);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const getMapsUrl = (spot) => {
    if (spot.maps_url) return spot.maps_url;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' Goa')}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-extrabold text-blue-300">
            <Compass className="w-3.5 h-3.5" />
            <span>Curated Goa Experiences</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Explore <span className="text-blue-400">Goa</span> Beyond Campus
          </h1>
          <p className="text-xs text-slate-300 max-w-lg">
            Discover beaches, waterfalls, food shacks, and historic forts recommended by fellow GIM students.
          </p>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                if (onLogAction) onLogAction('FILTER_EXPLORE', `Filtered places by category: ${cat}`);
              }}
              className={`py-2.5 px-5 rounded-2xl text-xs font-extrabold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="text-xs font-bold text-slate-400 shrink-0">
          {filteredPlaces.length} Destinations
        </span>
      </div>

      {/* Spots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlaces.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
          >
            <div>
              <div className="relative h-52 w-full bg-slate-100 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-extrabold bg-blue-600 text-white shadow-sm">
                  {item.category}
                </span>

                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {/* Google Maps Quick Link Icon */}
                  <a
                    href={getMapsUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-white/90 backdrop-blur-md rounded-full text-blue-600 hover:bg-white shadow-md transition-all hover:scale-110"
                    title="Open in Google Maps"
                  >
                    <MapPin className="w-4 h-4 fill-blue-600/10" />
                  </a>

                  {/* Bookmark Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleBookmark) onToggleBookmark(item.id);
                    }}
                    className={`p-2 rounded-full backdrop-blur-md transition-all ${
                      item.is_bookmarked
                        ? 'bg-rose-500 text-white shadow-md'
                        : 'bg-white/90 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${item.is_bookmarked ? 'fill-white' : ''}`} />
                  </button>
                </div>

                <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-[11px] font-extrabold bg-slate-950/70 backdrop-blur-md text-white flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>{item.rating || 4.5}</span>
                </div>
              </div>

              <div className="p-5 space-y-2">
                <h3 className="font-black text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                  {item.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium line-clamp-2">
                  {item.description || item.distance}
                </p>

                <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-2 border-t border-slate-100">
                  <span className="text-slate-400">{item.distance}</span>
                  <span className="text-blue-600 font-extrabold">{item.price}</span>
                </div>
              </div>
            </div>

            <div className="p-5 pt-0 flex items-center gap-2">
              <button
                onClick={() => handleOpenSpot(item)}
                className="w-full py-3 bg-slate-900 hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Info className="w-4 h-4" />
                <span>View Details, Ratings & Reviews</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Spot Detail, Reviews & Google Maps Modal */}
      {selectedSpot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setSelectedSpot(null)}
              className="absolute top-4 right-4 z-10 p-2.5 bg-white/80 backdrop-blur-md rounded-full text-slate-700 hover:bg-white shadow-md transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Hero Image */}
            <div className="relative h-64 w-full bg-slate-100">
              <img src={selectedSpot.image} alt={selectedSpot.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent flex items-end p-6">
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-blue-600 text-white text-[11px] font-extrabold rounded-full shadow-sm">
                      {selectedSpot.category}
                    </span>
                    <span className="px-3 py-1 bg-amber-400 text-slate-950 text-[11px] font-extrabold rounded-full shadow-sm flex items-center gap-1">
                      <Star className="w-3 h-3 fill-slate-950" />
                      {selectedSpot.rating || 4.5} Rating
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-white">{selectedSpot.name}</h2>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Google Maps & Navigation Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/80 border border-blue-200/80 p-4 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-blue-950 block">Google Maps Directions</span>
                    <span className="text-[11px] font-medium text-blue-700">{selectedSpot.distance}</span>
                  </div>
                </div>

                <a
                  href={getMapsUrl(selectedSpot)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Best Time, Cost & Duration Guidance Badges */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                  <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Best Time to Visit</span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {selectedSpot.best_time || '5:00 PM – 7:30 PM (Sunset)'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Estimated Expenses</span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {selectedSpot.est_cost || selectedSpot.price || '₹400 / person'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description & Pro Tips */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">About Destination</h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {selectedSpot.description || 'Popular travel destination in Goa frequented by GIM students for weekend outings.'}
                </p>

                {selectedSpot.pro_tips && (
                  <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-800">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Insider Campus Pro Tip</span>
                    </div>
                    <p className="text-xs text-amber-900 font-medium leading-relaxed">
                      {selectedSpot.pro_tips}
                    </p>
                  </div>
                )}
              </div>

              {/* User Ratings & Discussion Section */}
              <div className="space-y-4 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    <span>Student Reviews & Discussion</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-400">
                    {reviews.length} Comments
                  </span>
                </div>

                {/* Submit New Rating & Review Form */}
                <form onSubmit={handlePostReview} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-700">Give Your Star Rating:</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewRating(star)}
                          className="p-1 focus:outline-none transition-transform hover:scale-125"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= newRating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    required
                    placeholder="Share your travel advice, food recommendations, or scooter route tips..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {reviewMsg && (
                    <p className="text-xs font-bold text-emerald-600">{reviewMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="py-2.5 px-5 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/30 hover:bg-blue-700 transition-colors flex items-center gap-2 ml-auto"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingReview ? 'Submitting...' : 'Post Review'}</span>
                  </button>
                </form>

                {/* Discussion Thread Feed */}
                {loadingReviews ? (
                  <div className="py-6 text-center text-xs text-slate-400 font-bold">Loading comments...</div>
                ) : reviews.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 font-medium">
                    No reviews yet. Be the first to share your thoughts!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((rev) => (
                      <div key={rev.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                              {rev.user_avatar || 'US'}
                            </div>
                            <span className="font-extrabold text-xs text-slate-900">{rev.user_name}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed font-medium pl-9">
                          {rev.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
