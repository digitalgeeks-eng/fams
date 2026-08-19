import { Link } from 'react-router-dom';
import { useState } from 'react';
import { getImageUrl } from '../utils/imageUtils.js';

const PropertyCard = ({ property }) => {
  const [showDebug, setShowDebug] = useState(false);
  const imageUrl = getImageUrl(property.images?.[0]);
  const isUnavailable = property.isUnavailable || property.availabilityStatus === 'not_available';

  return (
    <div className="group overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/60 bg-white shadow-card transition duration-300 hover:-translate-y-2 hover:shadow-2xl">
      <div className="relative w-full bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden flex items-center justify-center min-h-[200px] h-48 sm:h-56">
        <img
          src={imageUrl}
          alt={property.title}
          className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
          onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/600x400'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100"></div>
        <div className="absolute left-3 top-3 sm:left-5 sm:top-5 inline-flex items-center rounded-full bg-white/95 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-900 shadow-md backdrop-blur-sm transition duration-300 group-hover:bg-white">
          ₦{property.price?.toLocaleString()}
        </div>
        <div className={`absolute right-3 top-3 sm:right-5 sm:top-5 inline-flex items-center rounded-full px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold shadow-md backdrop-blur-sm transition duration-300 ${isUnavailable ? 'bg-rose-600 text-white' : 'bg-slate-900/80 text-white hover:bg-slate-900'}`}>
          {isUnavailable ? 'Not Available' : property.approvalStatus || 'Pending'}
        </div>
      </div>
      <div className="space-y-3 sm:space-y-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-950 line-clamp-2 transition group-hover:text-primary">{property.title}</h3>
            <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-slate-500 flex items-center gap-1 truncate">
              📍 {property.location}
            </p>
          </div>
          <div className="rounded-full bg-gradient-to-r from-primary/10 to-accent/10 px-2 py-1 sm:px-3.5 sm:py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-primary whitespace-nowrap flex-shrink-0">
            {property.type || 'Room'}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <span className="inline-flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-yellow-50 to-orange-50 px-2.5 py-2 sm:px-3 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 border border-yellow-100/50">
            <span className="text-sm sm:text-lg">⭐</span>
            <span className="hidden sm:inline">{property.averageRating?.toFixed(1) || 'No rating'}</span>
            <span className="sm:hidden">{property.averageRating?.toFixed(1) || 'N/A'}</span>
          </span>
          <span className="inline-flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 px-2.5 py-2 sm:px-3 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 border border-blue-100/50">
            <span className="text-sm sm:text-lg">🛏️</span>
            <span>{property.type || 'Room'}</span>
          </span>
        </div>
        <p className="line-clamp-2 text-xs sm:text-sm leading-relaxed text-slate-600">{property.description || 'A comfortable property with premium amenities and convenient campus access.'}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:pt-2 border-t border-slate-100 pt-2">
          <Link to={`/properties/${property._id}`} className="inline-flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-primary to-blue-600 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white transition duration-300 hover:shadow-lg hover:from-blue-600 hover:to-blue-700 active:scale-95">
            View Details →
          </Link>
          <button
            type="button"
            onClick={() => setShowDebug((visible) => !visible)}
            className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-slate-600 sm:text-right py-1"
          >
            {showDebug ? 'Hide URL' : 'Show image URL'}
          </button>
        </div>
        {showDebug && (
          <pre className="mt-2 sm:mt-3 overflow-x-auto rounded-lg sm:rounded-xl bg-slate-50 p-2 sm:p-3 text-xs text-slate-600 break-all border border-slate-200">{imageUrl}</pre>
        )}
      </div>
    </div>
  );
};

export default PropertyCard;
