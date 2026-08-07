import React from 'react';

export default function UserAvatar({ user, className = 'w-10 h-10 text-sm' }) {
  const getInitials = (name) => {
    if (!name) return 'US';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const isUrl = user?.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://'));

  if (isUrl) {
    return (
      <img
        src={user.avatar}
        alt={user.name || 'User Avatar'}
        className={`${className} rounded-2xl object-cover border border-white/40 shadow-sm shrink-0`}
      />
    );
  }

  const initials = (user?.avatar && user.avatar.length <= 3) ? user.avatar : getInitials(user?.name);

  return (
    <div className={`${className} rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center border border-white/40 shadow-sm shrink-0 overflow-hidden`}>
      <span>{initials}</span>
    </div>
  );
}
