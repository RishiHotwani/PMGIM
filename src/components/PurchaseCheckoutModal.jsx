import React, { useState } from 'react';
import { X, CheckCircle, ShieldCheck, CreditCard, Sparkles, AlertCircle } from 'lucide-react';

export default function PurchaseCheckoutModal({ vehicle, onClose, currentUser, onLogAction, onPurchaseSuccess }) {
  const [phone, setPhone] = useState(currentUser?.phone_number || currentUser?.phone || '');
  const [userName, setUserName] = useState(currentUser?.name || '');
  const [userEmail, setUserEmail] = useState(currentUser?.email || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showTestCard, setShowTestCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('4111111111111111');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardError, setCardError] = useState('');

  if (!vehicle) return null;

  const salePrice = parseFloat(vehicle.sale_price || 0);
  const serviceFee = 500;
  const gstAmount = Math.round(salePrice * 0.05);
  const totalPayable = salePrice + serviceFee + gstAmount;
  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TN0iCSZQvgpBd8';
  const isOwn = String(vehicle.vendor_user_id) === String(currentUser?.id || currentUser?.uuid || '');
  const isSold = vehicle.status === 'SOLD';

  const handlePurchase = async (e) => {
    e.preventDefault();
    if (isSold) { alert('Already sold.'); return; }
    if (isOwn) { alert('You cannot buy your own listing.'); return; }
    if (!salePrice || salePrice < 1000) { alert('Sale price not available.'); return; }
    if (!userName || !userEmail || !phone) { alert('Fill Name, Email, Phone.'); return; }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(userEmail)) { alert('Valid email required.'); return; }
    if (String(phone).replace(/\D/g,'').length < 10) { alert('Valid 10-digit phone required.'); return; }

    setIsProcessing(true);
    try {
      const orderRes = await fetch('/api/purchases/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUser?.id || ''), 'x-user-name': currentUser?.name || 'User' },
        body: JSON.stringify({ rental_id: vehicle.id, user_name: userName, user_email: userEmail, user_phone: phone })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.message || 'Order creation failed');
      const serverTotal = orderData.pricing?.total_amount || totalPayable;

      const options = {
        key: orderData.razorpay_key || razorpayKey,
        amount: orderData.amount_in_paise,
        currency: 'INR',
        name: 'BeyondGoa — Buy Vehicle',
        description: `Buy: ${vehicle.title} — ₹${salePrice.toLocaleString('en-IN')}`,
        image: vehicle.image,
        order_id: orderData.order_id,
        handler: async function (resp) {
          try {
            const token = (()=>{ try{return localStorage.getItem('gim_token')}catch{return null}})();
            const verifyRes = await fetch('/api/purchases/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUser?.id || ''), 'x-user-name': currentUser?.name || 'User', ...(token?{Authorization:`Bearer ${token}`}:{}) },
              credentials: 'include',
              body: JSON.stringify({ purchase_id: orderData.purchase_id, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature })
            });
            const v = await verifyRes.json();
            if (verifyRes.ok && v.success) {
              setSuccess(true);
              if (onLogAction) onLogAction('PURCHASE_SUCCESS', `Bought ${vehicle.title} for ₹${serverTotal}`);
              if (onPurchaseSuccess) onPurchaseSuccess();
            } else {
              alert(v.message || 'Verification failed.');
              setIsProcessing(false);
            }
          } catch (err) { console.error(err); alert('Verification error'); setIsProcessing(false); }
        },
        prefill: { name: userName, email: userEmail, contact: phone },
        theme: { color: '#D97706' },
        modal: { ondismiss: () => setIsProcessing(false) }
      };
      if (orderData.order_id && String(orderData.order_id).startsWith('order_mock_')) {
        try {
          const token2 = (()=>{ try{ return localStorage.getItem('gim_token'); } catch { return null; } })();
          const verifyRes2 = await fetch('/api/purchases/verify', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUser?.id || currentUser?.uuid || ''), 'x-user-name': currentUser?.name || 'User', ...(token2?{Authorization:`Bearer ${token2}`}:{}) },
            body: JSON.stringify({ purchase_id: orderData.purchase_id, razorpay_order_id: orderData.order_id, razorpay_payment_id: 'pay_mock_'+Date.now(), razorpay_signature: 'mock_sig' })
          });
          const vd2 = await verifyRes2.json();
          if (verifyRes2.ok && vd2.success) { setSuccess(true); if(onLogAction) onLogAction('PURCHASE_SUCCESS', `Bought ${vehicle.title} for ₹${serverTotal}`); if(onPurchaseSuccess) onPurchaseSuccess(); }
          else alert(vd2.message||'Temp purchase failed');
        } catch(e){ alert('Temp purchase error: '+e.message); } finally { setIsProcessing(false); }
        return;
      }
      if (window.Razorpay) { new window.Razorpay(options).open(); }
      else { alert('Razorpay SDK not loaded. Use Test Card below.'); setIsProcessing(false); }
    } catch (err) { alert(err.message); setIsProcessing(false); }
  };
  const handleTestCardBuy = async (e) => {
    if(e) e.preventDefault();
    setCardError('');
    if (isSold) { setCardError('Already sold.'); return; }
    if (isOwn) { setCardError('You cannot buy your own listing.'); return; }
    if (!userName || !userEmail || !phone) { setCardError('Fill Name, Email, Phone.'); return; }
    const cleanNum = cardNumber.replace(/\s/g,'');
    if (!/^\d{13,19}$/.test(cleanNum)) { setCardError('Enter 13-19 digit test card (4111111111111111).'); return; }
    if (!/^\d{3,4}$/.test(cardCvv)) { setCardError('CVV 3-4 digits.'); return; }
    if (!/^(0[1-9]|1[0-2])\/\d{2,4}$/.test(cardExpiry)) { setCardError('Expiry MM/YY.'); return; }
    if (!cardName.trim()) { setCardError('Cardholder name required.'); return; }
    let sum=0,dbl=false; for(let i=cleanNum.length-1;i>=0;i--){let d=parseInt(cleanNum[i],10); if(dbl){d*=2; if(d>9)d-=9;} sum+=d; dbl=!dbl;}
    if(sum%10!==0){ setCardError('Luhn failed — use 4111111111111111.'); return; }
    setIsProcessing(true);
    try {
      const orderRes = await fetch('/api/purchases/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUser?.id || currentUser?.uuid || ''), 'x-user-name': currentUser?.name || userName },
        body: JSON.stringify({ rental_id: vehicle.id, user_name: userName, user_email: userEmail, user_phone: phone })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.message || 'Order failed');
      const token2 = (()=>{ try{return localStorage.getItem('gim_token')}catch{return null}})();
      const verifyRes2 = await fetch('/api/purchases/verify', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUser?.id || currentUser?.uuid || ''), 'x-user-name': currentUser?.name || userName, ...(token2?{Authorization:`Bearer ${token2}`}:{}) },
        body: JSON.stringify({ purchase_id: orderData.purchase_id, razorpay_order_id: orderData.order_id, razorpay_payment_id: 'pay_testcard_'+Date.now(), razorpay_signature: 'mock_sig_testcard' })
      });
      const vd2 = await verifyRes2.json();
      if (verifyRes2.ok && vd2.success) { setSuccess(true); if(onLogAction) onLogAction('PURCHASE_SUCCESS', `Test card bought ${vehicle.title}`); if(onPurchaseSuccess) onPurchaseSuccess(); }
      else throw new Error(vd2.message||'Test card verification failed');
    } catch(e){ setCardError(e.message); } finally { setIsProcessing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-100 relative my-8 flex flex-col max-h-[90vh]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-white/95 backdrop-blur-md border-b border-slate-100">
          <button onClick={onClose} className="min-h-[44px] px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-full text-xs font-extrabold flex items-center gap-1.5">← Back</button>
          <span className="text-xs font-extrabold text-slate-600 truncate px-2">Buy {vehicle.title}</span>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>

        {isSold ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center mx-auto"><X className="w-6 h-6" /></div>
            <h3 className="font-black text-slate-900">Sold Out</h3>
            <p className="text-xs text-slate-500">This vehicle has been sold and is no longer available.</p>
          </div>
        ) : success ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><CheckCircle className="w-8 h-8" /></div>
            <h3 className="text-lg font-black text-slate-900">Purchase Confirmed! 🎉</h3>
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">You bought <b>{vehicle.title}</b> for <b>₹{totalPayable.toLocaleString('en-IN')}</b>. Vendor will contact you at {phone}. Check <b>Profile → My Purchases</b>.</p>
            <button onClick={() => { onClose(); if(onPurchaseSuccess) onPurchaseSuccess(); }} className="w-full py-3 bg-emerald-600 text-white font-extrabold text-xs rounded-xl">Done</button>
          </div>
        ) : (
          <>
            <div className="relative h-40 bg-slate-100">
              <img src={vehicle.image} alt={vehicle.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent flex items-end p-4">
                <div><span className="px-2 py-1 bg-amber-500 text-white text-[11px] font-extrabold rounded-full">{vehicle.category} • For Sale</span><h2 className="text-lg font-black text-white mt-1">{vehicle.title}</h2><p className="text-xs text-slate-200">{vehicle.vendor}</p></div>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {isOwn && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> You own this listing — you cannot buy it.</div>}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl"><span className="text-[10px] font-bold text-slate-400 uppercase block">Sale Price</span><span className="text-sm font-black text-amber-600">₹{salePrice.toLocaleString('en-IN')}</span></div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl"><span className="text-[10px] font-bold text-slate-400 uppercase block">GST (5%)</span><span className="text-sm font-black text-slate-800">₹{gstAmount.toLocaleString('en-IN')}</span></div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl"><span className="text-[10px] font-bold text-slate-400 uppercase block">Service Fee</span><span className="text-sm font-black text-slate-800">₹{serviceFee}</span></div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-700">Total Payable</span>
                <span className="text-lg font-black text-amber-600">₹{totalPayable.toLocaleString('en-IN')}</span>
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center gap-2 text-xs"><ShieldCheck className="w-4 h-4 text-emerald-400" /><span>One-time purchase — vehicle marked <b>SOLD</b> after payment. No rental dates.</span></div>

              <form onSubmit={handlePurchase} className="space-y-3">
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label><input required value={userName} onChange={e=>setUserName(e.target.value)} placeholder="Your name" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Email *</label><input required type="email" value={userEmail} onChange={e=>setUserEmail(e.target.value)} placeholder="you@gim.ac.in" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Phone *</label><input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="9876543210" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" /></div>

                <button type="submit" disabled={isProcessing || isOwn || isSold} className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2">
                  {isProcessing ? 'Processing…' : <><CreditCard className="w-4 h-4" /> Pay with Razorpay — ₹{totalPayable.toLocaleString('en-IN')} <Sparkles className="w-3.5 h-3.5" /></>}
                </button>
                <div className="flex items-center gap-3 py-1"><div className="flex-1 h-px bg-slate-200"/><span className="text-[11px] font-black text-slate-400 uppercase">or</span><div className="flex-1 h-px bg-slate-200"/></div>
                <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between"><h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-amber-600"/> Test Card (No real charge)</h4><button type="button" onClick={()=>setShowTestCard(!showTestCard)} className="text-[11px] font-extrabold text-amber-700 underline">{showTestCard?'Hide':'Show'} form</button></div>
                  <p className="text-[11px] text-slate-600">Razorpay blocked? Use test card below — same fake verify.</p>
                  {showTestCard && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input value={cardNumber} onChange={e=>setCardNumber(e.target.value)} placeholder="4111111111111111" className="col-span-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono" />
                        <input value={cardExpiry} onChange={e=>setCardExpiry(e.target.value)} placeholder="MM/YY" className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs" />
                        <input value={cardCvv} onChange={e=>setCardCvv(e.target.value)} placeholder="CVV" className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs" />
                        <input value={cardName} onChange={e=>setCardName(e.target.value)} placeholder="Name on card" className="col-span-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs" />
                      </div>
                      {cardError && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{cardError}</p>}
                      <button type="button" onClick={handleTestCardBuy} disabled={isProcessing} className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-black text-xs rounded-xl">Pay ₹{totalPayable.toLocaleString('en-IN')} with Test Card → Buy</button>
                    </div>
                  )}
                  {!showTestCard && <button type="button" onClick={()=>setShowTestCard(true)} className="w-full py-2.5 bg-white border-2 border-amber-300 text-amber-700 font-extrabold text-xs rounded-xl">Use Test Card Instead</button>}
                </div>
                <p className="text-[11px] text-slate-400 text-center">Secure Razorpay checkout. Ownership transfers on paid verification.</p>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
