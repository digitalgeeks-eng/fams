import Property from '../models/Property.js';
import Recommendation from '../models/Recommendation.js';

// Calculate distance between two GPS coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const updateUserLocation = async ({ userId, latitude, longitude, locationName }) => {
  if (!latitude || !longitude) return;

  const record = await Recommendation.findOne({ userId });
  
  if (!record) {
    // First time tracking location
    await Recommendation.create({
      userId,
      currentLocation: { latitude, longitude, locationName, lastUpdated: new Date() },
      visitedLocations: [{ latitude, longitude, locationName, visitCount: 1, lastVisit: new Date() }]
    });
    return;
  }

  // Update current location
  record.currentLocation = { latitude, longitude, locationName, lastUpdated: new Date() };

  // Check if this location already exists in visitedLocations
  const existingLocation = record.visitedLocations.find((loc) => {
    const distance = calculateDistance(loc.latitude, loc.longitude, latitude, longitude);
    return distance < (loc.radius || 500); // Within 500m radius
  });

  if (existingLocation) {
    existingLocation.visitCount += 1;
    existingLocation.lastVisit = new Date();
  } else {
    record.visitedLocations.push({
      latitude,
      longitude,
      locationName,
      visitCount: 1,
      lastVisit: new Date()
    });
  }

  record.updatedAt = new Date();
  await record.save();
};

export const trackPropertyTypePreference = async ({ userId, propertyType }) => {
  const record = await Recommendation.findOne({ userId });
  
  if (!record) {
    await Recommendation.create({
      userId,
      propertyTypePreferences: [{ type: propertyType, count: 1, lastSearched: new Date() }]
    });
    return;
  }

  const existing = record.propertyTypePreferences.find((p) => p.type === propertyType);
  if (existing) {
    existing.count += 1;
    existing.lastSearched = new Date();
  } else {
    record.propertyTypePreferences.push({ type: propertyType, count: 1, lastSearched: new Date() });
  }

  record.updatedAt = new Date();
  await record.save();
};

export const updateRecommendationData = async ({ userId, viewedProperty, searchQuery, location, minPrice, maxPrice, propertyType }) => {
  const record = await Recommendation.findOne({ userId });
  const priceInteractions = { minPrice, maxPrice, averagePrice: minPrice && maxPrice ? (minPrice + maxPrice) / 2 : (record?.priceInteractions?.averagePrice || 0) };
  const updates = {
    $set: {
      updatedAt: new Date(),
      priceInteractions
    }
  };

  if (viewedProperty) {
    updates.$addToSet = { viewedProperties: viewedProperty };
  }

  if (searchQuery || location || minPrice || maxPrice) {
    updates.$push = {
      searchHistory: {
        query: searchQuery || '',
        location: location || '',
        priceRange: `${minPrice || 0}-${maxPrice || 0}`,
        createdAt: new Date()
      }
    };
  }

  if (location) {
    updates.$addToSet = {
      ...(updates.$addToSet || {}),
      preferredLocations: location
    };
  }

  if (propertyType) {
    await trackPropertyTypePreference({ userId, propertyType });
  }

  await Recommendation.findOneAndUpdate({ userId }, updates, { upsert: true, new: true });
};

export const getRecommendations = async (userId) => {
  const record = await Recommendation.findOne({ userId });
  if (!record) {
    // No preferences yet, return newest approved properties
    return await Property.find({ approvalStatus: 'approved' }).sort({ createdAt: -1 }).limit(8);
  }

  const filter = { approvalStatus: 'approved' };

  // Priority 1: Recommend properties near frequently visited locations
  if (record.visitedLocations && record.visitedLocations.length > 0) {
    const mostVisitedLocations = record.visitedLocations
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 3);

    if (mostVisitedLocations.length > 0) {
      filter.location = { $in: mostVisitedLocations.map((loc) => loc.locationName) };
      const recommended = await Property.find(filter).sort({ createdAt: -1 }).limit(8);
      if (recommended.length > 0) return recommended;
    }
  }

  // Priority 2: Fall back to preferred locations
  const preferredLocations = record?.preferredLocations || [];
  const priceRange = record?.priceInteractions?.averagePrice || 0;

  if (preferredLocations.length) filter.location = { $in: preferredLocations };
  if (priceRange) {
    filter.price = { $gte: Math.max(0, priceRange - 30000), $lte: priceRange + 30000 };
  }

  const recommended = await Property.find(filter)
    .sort({ 
      createdAt: -1,
      averageRating: -1 // Also prioritize higher-rated properties
    })
    .limit(8);
  
  return recommended;
};
