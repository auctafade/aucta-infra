// backend/lib/sprint8/contactVersioning.js

// In-memory storage for versions (in production, use database)
const contactVersions = new Map();

// Create a version snapshot
function createContactVersion(contactId, previousData, newData, actorId, action = 'update') {
  const version = {
    id: generateVersionId(),
    contactId,
    versionNumber: getNextVersionNumber(contactId),
    action, // 'create', 'update', 'merge', 'delete'
    previousData: previousData ? JSON.parse(JSON.stringify(previousData)) : null,
    newData: JSON.parse(JSON.stringify(newData)),
    changes: calculateChanges(previousData, newData),
    actorId,
    timestamp: new Date().toISOString(),
    reason: null // Can be set for major changes
  };

  // Store version
  if (!contactVersions.has(contactId)) {
    contactVersions.set(contactId, []);
  }
  contactVersions.get(contactId).push(version);

  // Keep only last 50 versions per contact (in production, archive older versions)
  const versions = contactVersions.get(contactId);
  if (versions.length > 50) {
    contactVersions.set(contactId, versions.slice(-50));
  }

  console.log(`Created version ${version.versionNumber} for contact ${contactId}`);
  return version;
}

// Get all versions for a contact
function getContactVersions(contactId, limit = 20) {
  const versions = contactVersions.get(contactId) || [];
  return versions.slice(-limit).reverse(); // Most recent first
}

// Get specific version
function getContactVersion(contactId, versionNumber) {
  const versions = contactVersions.get(contactId) || [];
  return versions.find(v => v.versionNumber === versionNumber);
}

// Calculate what changed between versions
function calculateChanges(oldData, newData) {
  if (!oldData) return { type: 'created', fields: Object.keys(newData || {}) };

  const changes = {
    type: 'updated',
    added: [],
    modified: [],
    removed: []
  };

  const oldKeys = new Set(Object.keys(oldData));
  const newKeys = new Set(Object.keys(newData));

  // Find added fields
  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      changes.added.push(key);
    }
  }

  // Find removed fields
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      changes.removed.push(key);
    }
  }

  // Find modified fields
  for (const key of newKeys) {
    if (oldKeys.has(key)) {
      if (!deepEqual(oldData[key], newData[key])) {
        changes.modified.push({
          field: key,
          oldValue: oldData[key],
          newValue: newData[key]
        });
      }
    }
  }

  return changes;
}

// Deep equality check
function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  
  if (typeof obj1 !== typeof obj2) return false;
  
  if (typeof obj1 !== 'object') return obj1 === obj2;
  
  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
}

// Generate version ID
function generateVersionId() {
  return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get next version number for contact
function getNextVersionNumber(contactId) {
  const versions = contactVersions.get(contactId) || [];
  return versions.length + 1;
}

// Restore contact to specific version
function restoreContactToVersion(contactId, versionNumber, actorId) {
  const version = getContactVersion(contactId, versionNumber);
  if (!version) {
    throw new Error(`Version ${versionNumber} not found for contact ${contactId}`);
  }

  // Create a new version for the restore action
  const restoreVersion = createContactVersion(
    contactId,
    null, // Current data would be fetched from database
    version.newData,
    actorId,
    'restore'
  );

  return {
    restoredData: version.newData,
    restoreVersion
  };
}

// Get contact history summary
function getContactHistorySummary(contactId) {
  const versions = contactVersions.get(contactId) || [];
  
  if (versions.length === 0) {
    return {
      contactId,
      totalVersions: 0,
      created: null,
      lastModified: null,
      summary: 'No history available'
    };
  }

  const firstVersion = versions[0];
  const lastVersion = versions[versions.length - 1];

  return {
    contactId,
    totalVersions: versions.length,
    created: {
      timestamp: firstVersion.timestamp,
      actorId: firstVersion.actorId
    },
    lastModified: {
      timestamp: lastVersion.timestamp,
      actorId: lastVersion.actorId,
      action: lastVersion.action
    },
    recentChanges: versions.slice(-5).map(v => ({
      version: v.versionNumber,
      action: v.action,
      timestamp: v.timestamp,
      actorId: v.actorId,
      changesCount: v.changes.modified ? v.changes.modified.length : 0
    }))
  };
}

// Clean up old versions (utility function)
function cleanupOldVersions(olderThanDays = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  let cleanedCount = 0;
  
  for (const [contactId, versions] of contactVersions.entries()) {
    const filteredVersions = versions.filter(v => new Date(v.timestamp) > cutoffDate);
    
    if (filteredVersions.length !== versions.length) {
      contactVersions.set(contactId, filteredVersions);
      cleanedCount += versions.length - filteredVersions.length;
    }
  }

  console.log(`Cleaned up ${cleanedCount} old contact versions`);
  return cleanedCount;
}

module.exports = {
  createContactVersion,
  getContactVersions,
  getContactVersion,
  calculateChanges,
  restoreContactToVersion,
  getContactHistorySummary,
  cleanupOldVersions
};
