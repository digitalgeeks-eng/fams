import mongoose from 'mongoose';

const changeSchema = new mongoose.Schema({
  field: { type: String, required: true },
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const propertyEditHistorySchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  editorRole: { type: String, enum: ['agent', 'admin'], required: true },
  editedAt: { type: Date, default: Date.now },
  changes: { type: [changeSchema], required: true }
});

export default mongoose.model('PropertyEditHistory', propertyEditHistorySchema);