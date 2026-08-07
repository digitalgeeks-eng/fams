import mongoose from 'mongoose';

const visitedLocationSchema = new mongoose.Schema({
  latitude: Number,
  longitude: Number,
  locationName: String,
  visitCount: { type: Number, default: 1 },
  lastVisit: { type: Date, default: Date.now },
  radius: { type: Number, default: 500 } // meters - consider locations within 500m as same place
}, { _id: false });

const propertyTypePreferenceSchema = new mongoose.Schema({
  type: { type: String },
  count: { type: Number, default: 1 },
  lastSearched: { type: Date, default: Date.now }
}, { _id: false });

const recommendationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  viewedProperties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  searchHistory: [{ query: String, location: String, priceRange: String, createdAt: Date }],
  preferredLocations: [{ type: String }],
  
  // NEW: Location tracking with GPS
  visitedLocations: [visitedLocationSchema],
  currentLocation: {
    latitude: Number,
    longitude: Number,
    locationName: String,
    lastUpdated: Date
  },
  
  // NEW: Property type and price preferences
  propertyTypePreferences: [propertyTypePreferenceSchema],
  
  priceInteractions: {
    minPrice: Number,
    maxPrice: Number,
    averagePrice: Number
  },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Recommendation', recommendationSchema);
