import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { getImageUrl } from '../utils/imageUtils.js';

const AgentVerification = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await api.get('/admin/agents');
        setAgents(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const openAgentDetails = (agent) => {
    setSelectedAgent(agent);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedAgent(null);
  };

  const fetchAgentDetails = async (agentId) => {
    try {
      const response = await api.get(`/admin/agents/${agentId}`);
      setSelectedAgent(response.data.data);
    } catch (err) {
      console.error('Failed to load agent details', err);
    }
  };

  const updateStatus = async (id, status) => {
    setError(null);
    setMessage(null);
    try {
      const response = await api.put(`/admin/agents/${id}/verify`, { status });
      const updatedStatus = response.data.data.verificationStatus;
      setAgents((prev) => prev.map((agent) => (agent._id === id ? { ...agent, verificationStatus: updatedStatus } : agent)));
      setMessage(`Agent ${updatedStatus === 'verified' ? 'verified' : 'rejected'} successfully.`);
      if (showModal) closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update agent status.');
      console.error(err);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agent verification</h1>
          <p className="mt-2 text-slate-600">All registered agents are shown below. Use the filter to narrow by status.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Filter</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-3xl border border-slate-200 bg-white px-4 py-3">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      {message && <div className="rounded-2xl bg-emerald-100 border border-emerald-200 p-4 text-emerald-700">{message}</div>}
      {error && <div className="rounded-2xl bg-rose-100 border border-rose-200 p-4 text-rose-700">{error}</div>}
      <div className="grid gap-4">
        {agents.filter((agent) => filterStatus === 'all' || agent.verificationStatus === filterStatus).map((agent) => {
          const disabled = agent.verificationStatus !== 'pending';
          return (
            <div key={agent._id} className="rounded-3xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{agent.name}</p>
                  <p className="text-slate-600">{agent.email}</p>
                  {agent.phone && <p className="text-slate-600">Phone: {agent.phone}</p>}
                  {agent.company && <p className="text-slate-600">Company: {agent.company}</p>}
                  <p className="text-slate-600">Status: {agent.verificationStatus}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      openAgentDetails(agent);
                      fetchAgentDetails(agent._id);
                    }}
                    className="px-3 py-2 rounded-2xl text-white bg-blue-500 hover:bg-blue-600"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => updateStatus(agent._id, 'verified')}
                    disabled={disabled}
                    className={`px-3 py-2 rounded-2xl text-white ${disabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-slate-900'}`}
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => updateStatus(agent._id, 'rejected')}
                    disabled={disabled}
                    className={`px-3 py-2 rounded-2xl text-white ${disabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent Details Modal */}
      {showModal && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Agent Full Details</h2>
              <button onClick={closeModal} className="text-2xl text-slate-500 hover:text-slate-900">&times;</button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-slate-900">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Full Name</p>
                    <p className="text-lg font-semibold">{selectedAgent.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Email</p>
                    <p className="text-lg font-semibold">{selectedAgent.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Phone</p>
                    <p className="text-lg font-semibold">{selectedAgent.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Company</p>
                    <p className="text-lg font-semibold">{selectedAgent.company || 'Not provided'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-slate-600">Address</p>
                    <p className="text-lg font-semibold">{selectedAgent.address || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">ID Number</p>
                    <p className="text-lg font-semibold">{selectedAgent.idNumber || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Years of Experience</p>
                    <p className="text-lg font-semibold">{selectedAgent.yearsOfExperience || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Professional Details */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4 text-slate-900">Professional Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">License Number</p>
                    <p className="text-lg font-semibold">{selectedAgent.licenseNumber || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Verification Status</p>
                    <p className="text-lg font-semibold capitalize">{selectedAgent.verificationStatus}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-slate-600">Bio</p>
                    <p className="text-lg font-semibold">{selectedAgent.bio || 'Not provided'}</p>
                  </div>
                  {selectedAgent.certifications && selectedAgent.certifications.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-600">Certifications</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedAgent.certifications.map((cert, idx) => (
                          <span key={idx} className="rounded-2xl bg-blue-100 text-blue-700 px-3 py-1 text-sm">
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents */}
              {(selectedAgent.idImage || selectedAgent.licenseImage) && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4 text-slate-900">Documents</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedAgent.idImage && (
                      <div>
                        <p className="text-sm text-slate-600 mb-2">ID Document</p>
                        <img
                          src={getImageUrl(selectedAgent.idImage)}
                          alt="Agent ID"
                          className="rounded-2xl max-w-full h-auto max-h-64 object-cover"
                          onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400x300'; }}
                        />
                      </div>
                    )}
                    {selectedAgent.licenseImage && (
                      <div>
                        <p className="text-sm text-slate-600 mb-2">License Document</p>
                        <img
                          src={getImageUrl(selectedAgent.licenseImage)}
                          alt="Agent License"
                          className="rounded-2xl max-w-full h-auto max-h-64 object-cover"
                          onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400x300'; }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Properties Summary */}
              {selectedAgent.properties && selectedAgent.properties.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4 text-slate-900">Agent Properties ({selectedAgent.totalProperties})</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="rounded-2xl bg-green-50 p-3">
                      <p className="text-sm text-green-600">Approved</p>
                      <p className="text-2xl font-bold text-green-700">{selectedAgent.approvedProperties || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-3">
                      <p className="text-sm text-amber-600">Pending</p>
                      <p className="text-2xl font-bold text-amber-700">{selectedAgent.pendingProperties || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-red-50 p-3">
                      <p className="text-sm text-red-600">Rejected</p>
                      <p className="text-2xl font-bold text-red-700">{selectedAgent.rejectedProperties || 0}</p>
                    </div>
                  </div>

                  {/* Properties List */}
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedAgent.properties.map((prop) => (
                      <div key={prop._id} className="rounded-2xl border border-slate-200 p-3 bg-slate-50">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{prop.title}</p>
                            <p className="text-sm text-slate-600">{prop.location} • {prop.type}</p>
                            <p className="text-sm text-slate-600">₦{prop.price?.toLocaleString()}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            prop.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' :
                            prop.approvalStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {prop.approvalStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="border-t pt-6 flex gap-3">
                <button
                  onClick={() => updateStatus(selectedAgent._id, 'verified')}
                  disabled={selectedAgent.verificationStatus !== 'pending'}
                  className={`flex-1 px-4 py-3 rounded-2xl text-white font-semibold ${selectedAgent.verificationStatus !== 'pending' ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-slate-900'}`}
                >
                  Verify Agent
                </button>
                <button
                  onClick={() => updateStatus(selectedAgent._id, 'rejected')}
                  disabled={selectedAgent.verificationStatus !== 'pending'}
                  className={`flex-1 px-4 py-3 rounded-2xl text-white font-semibold ${selectedAgent.verificationStatus !== 'pending' ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
                >
                  Reject Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AgentVerification;
