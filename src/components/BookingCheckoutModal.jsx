import React, { useState } from 'react';
import { Calendar, ShieldCheck, CreditCard, Sparkles, X, CheckCircle, Car, MapPin, Fuel, AlertCircle } from 'lucide-react';

export default function BookingCheckoutModal({ vehicle, onClose, currentUser, onLogAction }) {
  const [days, setDays] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [userName, setUserName] = useState(currentUser?.name || '');
  const [userEmail, setUserEmail] = useState(currentUser?.email || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  if (!vehicle) return null;

  const dailyRate = parseFloat(vehicle.price_per_day || vehicle.price || 350);
  const baseTotal = dailyRate * days;
  const deposit = vehicle.category === 'Car' ? 2000 : 500;
  const serviceFee = 50;
  const gstAmount = Math.round((baseTotal + serviceFee) * 0.18);
  const finalPayableTotal = baseTotal + deposit + serviceFee + gstAmount;

  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TN0iCSZQvgpBd8';

  const handleRazorpayPayment = async (e) => {
    e.preventDefault();
    if (!userName || !userEmail || !phone) {
      alert('Please fill in your Name, Email, and Phone number.');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Create order on server (Server is authoritative source of truth for pricing)
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-name': currentUser?.name || 'User'
        },
        body: JSON.stringify({
          rental_id: vehicle.id,
          vehicle_title: vehicle.title,
          vendor_user_id: vehicle.vendor_user_id || null,
          days,
          start_date: startDate,
          user_name: userName,
          user_email: userEmail,
          user_phone: phone
        })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.message || 'Order creation failed');

      const serverTotalAmount = orderData.pricing?.total_amount || finalPayableTotal;

      // 2. Trigger Razorpay Checkout Modal with exact server amount_in_paise
      const options = {
        key: orderData.razorpay_key || razorpayKey,
        amount: orderData.amount_in_paise,
        currency: 'INR',
        name: 'BeyondGoa Campus Mobility',
        description: `Rental Booking: ${vehicle.title} (${days} Day${days > 1 ? 's' : ''})`,
        image: vehicle.image || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
        order_id: orderData.order_id,
        handler: async function (response) {
          // 3. Verify Payment Signature
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser?.id || '',
                'x-user-name': currentUser?.name || 'User'
              },
              body: JSON.stringify({
                booking_id: orderData.booking_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setBookingSuccess(true);
              if (onLogAction) {
                onLogAction('PAYMENT_SUCCESS', `Paid ₹${serverTotalAmount} for ${vehicle.title} via Razorpay`);
              }
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          } catch (err) {
            console.error('Verification error:', err);
            alert('Error verifying payment.');
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: userName,
          email: userEmail,
          contact: phone
        },
        theme: {
          color: '#2563EB'
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          }
        }
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        alert('Razorpay SDK failed to load. Please refresh the page.');
        setIsProcessing(false);
      }
    } catch (err) {
      alert(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-100 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2.5 bg-white/80 backdrop-blur-md rounded-full text-slate-700 hover:bg-white shadow-md transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {bookingSuccess ? (
          /* Booking Success Screen */
          <div className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full uppercase tracking-wider">
                Payment Confirmed
              </span>
              <h2 className="text-2xl font-black text-slate-900">Booking Confirmed!</h2>
              <p className="text-xs text-slate-600 font-medium max-w-md mx-auto">
                Your reservation for <strong className="text-slate-900">{vehicle.title}</strong> is active. The vendor (<strong className="text-blue-600">{vehicle.vendor}</strong>) will contact you shortly for key pickup at {vehicle.location || 'Sanquelim Gate'}.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Paid</span>
                <span className="font-extrabold text-emerald-600 text-sm">₹{finalPayableTotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rental Period</span>
                <span className="font-bold text-slate-800">{days} Day(s) starting {startDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Security Deposit</span>
                <span className="font-bold text-slate-800">₹{deposit} (Refundable on return)</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 bg-blue-600 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors"
            >
              Done & Return to Fleet
            </button>
          </div>
        ) : (
          /* Checkout & Payment Form */
          <div>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-black text-blue-300">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Razorpay 1-Click Secure Checkout</span>
              </div>
              <h2 className="text-xl font-black">Vehicle Booking & Receipt</h2>
              <p className="text-xs text-slate-300">Review breakdown and complete reservation</p>
            </div>

            <form onSubmit={handleRazorpayPayment} className="p-6 space-y-6">
              {/* Vehicle Snapshot Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4">
                <img
                  src={vehicle.image}
                  alt={vehicle.title}
                  className="w-20 h-20 rounded-xl object-cover shrink-0"
                />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-md">
                      {vehicle.category}
                    </span>
                    <span className="text-xs font-black text-blue-600">₹{dailyRate}/day</span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-sm truncate">{vehicle.title}</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Vendor: {vehicle.vendor}</p>
                </div>
              </div>

              {/* Rental Duration & Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-700">Rental Duration (Days):</label>
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setDays(Math.max(1, days - 1))}
                      className="px-3 py-2 bg-slate-100 text-slate-700 font-black hover:bg-slate-200"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-extrabold text-xs text-slate-900">{days} Day{days > 1 ? 's' : ''}</span>
                    <button
                      type="button"
                      onClick={() => setDays(days + 1)}
                      className="px-3 py-2 bg-slate-100 text-slate-700 font-black hover:bg-slate-200"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-700">Start Pickup Date:</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Customer Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email Address"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  />
                </div>
              </div>

              {/* Itemized Price Breakdown */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs font-medium">
                <h4 className="font-extrabold text-slate-900 pb-1 border-b border-slate-200">Itemized Cost Summary</h4>
                <div className="flex justify-between text-slate-600">
                  <span>Daily Rental (₹{dailyRate} × {days} day{days > 1 ? 's' : ''})</span>
                  <span className="font-bold text-slate-800">₹{baseTotal}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Refundable Security Deposit</span>
                  <span className="font-bold text-slate-800">₹{deposit}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Platform Conveniencing Fee</span>
                  <span className="font-bold text-slate-800">₹{serviceFee}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST / Tax (18%)</span>
                  <span className="font-bold text-slate-800">₹{gstAmount}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
                  <span>Total Amount Payable</span>
                  <span className="text-blue-600">₹{finalPayableTotal}</span>
                </div>
              </div>

              {/* Pay Button */}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2 transform active:scale-95"
              >
                <CreditCard className="w-4 h-4" />
                <span>{isProcessing ? 'Connecting to Razorpay...' : `Pay ₹${finalPayableTotal} with Razorpay`}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
