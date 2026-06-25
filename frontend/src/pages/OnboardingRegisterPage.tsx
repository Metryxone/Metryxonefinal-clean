import { BRAND } from '@/design-system/tokens';
import React, { useState } from 'react';



function formatEntityType(type?: string): string {
  if (!type) return '';
  switch (type.toLowerCase()) {
    case 'ngo': return 'NGO';
    case 'lei': return 'LEI';
    default: return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  }
}

type EntityType = 'institute' | 'ngo' | 'mentor' | 'parent' | 'lei';

interface OnboardingRegisterPageProps {
  onNavigate: (screen: string) => void;
}

const entityConfig: Record<EntityType, { label: string; icon: string; description: string; fields: string[] }> = {
  institute: {
    label: 'School / College / Institute',
    icon: '🏫',
    description: 'Educational institutions offering formal learning programs',
    fields: ['registrationNumber', 'panNumber', 'gstNumber', 'website', 'organizationName', 'accreditationBody'],
  },
  ngo: {
    label: 'NGO / Foundation',
    icon: '🤝',
    description: 'Non-profit organizations driving social impact in education',
    fields: ['registrationNumber', 'panNumber', 'fcraNumber', 'website', 'organizationName'],
  },
  mentor: {
    label: 'Mentor / Counsellor',
    icon: '🎓',
    description: 'Psychologists, counsellors, coaches, and career mentors',
    fields: ['panNumber', 'linkedinUrl', 'yearsOfExperience', 'specializations'],
  },
  parent: {
    label: 'Parent / Guardian',
    icon: '👨‍👩‍👧',
    description: 'Parents enrolling their children on the MetryxOne platform',
    fields: ['childName', 'childAge', 'schoolName', 'grade'],
  },
  lei: {
    label: 'Learning & Ed-Tech Partner',
    icon: '💻',
    description: 'Ed-tech companies and online learning platforms',
    fields: ['registrationNumber', 'panNumber', 'gstNumber', 'website', 'organizationName'],
  },
};

type Step = 'select-type' | 'fill-form' | 'success';

export function OnboardingRegisterPage({ onNavigate }: OnboardingRegisterPageProps) {
  const [step, setStep] = useState<Step>('select-type');
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState<any>(null);
  const [trackEmail, setTrackEmail] = useState('');
  const [trackingResult, setTrackingResult] = useState<any>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const [form, setForm] = useState({
    entityName: '',
    entityEmail: '',
    entityPhone: '',
    contactPerson: '',
    contactDesignation: '',
    organizationName: '',
    registrationNumber: '',
    panNumber: '',
    gstNumber: '',
    fcraNumber: '',
    website: '',
    linkedinUrl: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    description: '',
    yearsOfExperience: '',
    specializations: '',
    accreditationBody: '',
    childName: '',
    childAge: '',
    schoolName: '',
    grade: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityType) return;
    setSubmitting(true);
    setError('');
    try {
      const payload: Record<string, any> = {
        entityType,
        entityName: form.entityName,
        entityEmail: form.entityEmail,
        entityPhone: form.entityPhone,
        contactPerson: form.contactPerson,
        contactDesignation: form.contactDesignation,
        city: form.city,
        state: form.state,
        address: form.address,
        pincode: form.pincode,
        description: form.description,
      };
      if (form.registrationNumber) payload.registrationNumber = form.registrationNumber;
      if (form.panNumber) payload.panNumber = form.panNumber;
      if (form.gstNumber) payload.gstNumber = form.gstNumber;
      if (form.fcraNumber) payload.fcraNumber = form.fcraNumber;
      if (form.website) payload.website = form.website;
      if (form.linkedinUrl) payload.linkedinUrl = form.linkedinUrl;
      if (form.organizationName) payload.organizationName = form.organizationName;
      if (form.yearsOfExperience) payload.yearsOfExperience = form.yearsOfExperience;
      if (form.specializations) payload.specializations = form.specializations;
      if (form.accreditationBody) payload.accreditationBody = form.accreditationBody;

      const res = await fetch('/api/onboarding/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setSubmittedRequest(data.request);
      setStep('success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingLoading(true);
    setTrackingResult(null);
    try {
      const res = await fetch(`/api/onboarding/status/${encodeURIComponent(trackEmail)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Not found');
      // API returns the object directly (not nested under 'request')
      setTrackingResult(data.request ? data : { request: data });
    } catch (err: any) {
      setTrackingResult({ error: err.message });
    } finally {
      setTrackingLoading(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending Review' },
      under_review: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Under Review' },
      approved: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Approved ✓' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
      suspended: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Suspended' },
    };
    const s = map[status] ?? { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8faff' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm" style={{ borderColor: BRAND.border }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 font-bold text-xl"
            style={{ color: BRAND.primary }}
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: BRAND.primary }}>M</span>
            MetryxOne
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('login')}
              className="text-sm font-medium px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: BRAND.border, color: BRAND.text }}
            >
              Login
            </button>
            <button
              onClick={() => onNavigate('landing')}
              className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors"
              style={{ backgroundColor: BRAND.primary }}
            >
              Back to Home
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Page Title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-3" style={{ color: BRAND.text }}>
            Partner Onboarding Registration
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
            Join MetryxOne's behavioral intelligence ecosystem. Fill in your details and our team will review your application within 3–5 business days.
          </p>
        </div>

        {/* Step: Select Entity Type */}
        {step === 'select-type' && (
          <div>
            <h2 className="text-lg font-semibold mb-5 text-center" style={{ color: BRAND.primary }}>
              Who are you registering as?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {(Object.entries(entityConfig) as [EntityType, typeof entityConfig[EntityType]][]).map(([type, cfg]) => (
                <button
                  key={type}
                  onClick={() => { setEntityType(type); setStep('fill-form'); }}
                  className="group p-5 rounded-xl border-2 bg-white text-left transition-all hover:shadow-md"
                  style={{ borderColor: entityType === type ? BRAND.primary : BRAND.border }}
                >
                  <div className="text-3xl mb-3">{cfg.icon}</div>
                  <div className="font-semibold text-sm mb-1" style={{ color: BRAND.text }}>{cfg.label}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{cfg.description}</div>
                </button>
              ))}
            </div>

            {/* Track Status */}
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: BRAND.border }}>
              <h3 className="font-semibold mb-3" style={{ color: BRAND.text }}>Track Your Application Status</h3>
              <p className="text-sm text-gray-500 mb-4">Already submitted a registration? Enter your email to check the status.</p>
              <form onSubmit={handleTrackStatus} className="flex gap-3">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={trackEmail}
                  onChange={e => setTrackEmail(e.target.value)}
                  required
                  className="flex-1 px-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: BRAND.border, '--tw-ring-color': BRAND.primary } as any}
                />
                <button
                  type="submit"
                  disabled={trackingLoading}
                  className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  {trackingLoading ? 'Checking…' : 'Check Status'}
                </button>
              </form>
              {trackingResult && !trackingResult.error && (
                <div className="mt-4 p-4 rounded-lg bg-gray-50 border" style={{ borderColor: BRAND.border }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{trackingResult.request?.entityName}</span>
                    <StatusBadge status={trackingResult.request?.status} />
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Type: <span className="font-medium">{formatEntityType(trackingResult.request?.entityType)}</span></div>
                    <div>Submitted: {new Date(trackingResult.request?.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    {trackingResult.request?.reviewNotes && (
                      <div className="mt-2 p-2 rounded bg-blue-50 text-blue-700">Note: {trackingResult.request.reviewNotes}</div>
                    )}
                  </div>
                </div>
              )}
              {trackingResult?.error && (
                <div className="mt-3 text-sm text-red-600">{trackingResult.error}</div>
              )}
            </div>
          </div>
        )}

        {/* Step: Fill Form */}
        {step === 'fill-form' && entityType && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: BRAND.border }}>
            {/* Form Header */}
            <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: BRAND.border, backgroundColor: `${BRAND.primary}08` }}>
              <button
                onClick={() => setStep('select-type')}
                className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                ← Back
              </button>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{entityConfig[entityType].icon}</span>
                <div>
                  <div className="font-semibold" style={{ color: BRAND.text }}>{entityConfig[entityType].label}</div>
                  <div className="text-xs text-gray-500">Registration Form</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: BRAND.primary }}>
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>
                      {entityType === 'mentor' ? 'Full Name' : entityType === 'parent' ? 'Your Full Name' : 'Institution / Organization Name'} *
                    </label>
                    <input name="entityName" value={form.entityName} onChange={handleChange} required
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: BRAND.border }}
                      placeholder={entityType === 'mentor' ? 'Dr. Kavya Reddy' : entityType === 'parent' ? 'Ramesh Kumar' : 'Delhi Public School — Sector 45'} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Email Address *</label>
                    <input name="entityEmail" type="email" value={form.entityEmail} onChange={handleChange} required
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: BRAND.border }}
                      placeholder="principal@school.edu.in" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Phone Number</label>
                    <input name="entityPhone" type="tel" value={form.entityPhone} onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: BRAND.border }}
                      placeholder="98XXXXXXXX" />
                  </div>
                  {entityType !== 'mentor' && entityType !== 'parent' && (
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Organization / Trust / Society Name</label>
                      <input name="organizationName" value={form.organizationName} onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: BRAND.border }}
                        placeholder="Delhi Public School Society" />
                    </div>
                  )}
                </div>
              </section>

              {/* Contact Person (for non-mentor) */}
              {entityType !== 'mentor' && (
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: BRAND.primary }}>Contact Person</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Contact Person Name *</label>
                      <input name="contactPerson" value={form.contactPerson} onChange={handleChange} required
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: BRAND.border }}
                        placeholder="Dr. Sunita Sharma" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Designation</label>
                      <input name="contactDesignation" value={form.contactDesignation} onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: BRAND.border }}
                        placeholder="Principal / Director" />
                    </div>
                  </div>
                </section>
              )}

              {/* Mentor-specific fields */}
              {entityType === 'mentor' && (
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: BRAND.primary }}>Professional Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Years of Experience</label>
                      <input name="yearsOfExperience" type="number" min="0" value={form.yearsOfExperience} onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: BRAND.border }} placeholder="5" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>LinkedIn Profile URL</label>
                      <input name="linkedinUrl" value={form.linkedinUrl} onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: BRAND.border }} placeholder="https://linkedin.com/in/kavya-reddy" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Specializations</label>
                      <input name="specializations" value={form.specializations} onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: BRAND.border }} placeholder="Career Counselling, Psychometric Assessment, Adolescent Psychology" />
                    </div>
                  </div>
                </section>
              )}

              {/* Parent-specific fields */}
              {entityType === 'parent' && (
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: BRAND.primary }}>Child Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Child's Name *</label>
                      <input name="childName" value={form.childName} onChange={handleChange} required
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: BRAND.border }} placeholder="Arjun Kumar" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Child's Age</label>
                      <input name="childAge" type="number" min="5" max="25" value={form.childAge} onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: BRAND.border }} placeholder="14" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>School Name</label>
                      <input name="schoolName" value={form.schoolName} onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: BRAND.border }} placeholder="Ryan International School" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Grade / Class</label>
                      <input name="grade" value={form.grade} onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: BRAND.border }} placeholder="Class 9" />
                    </div>
                  </div>
                </section>
              )}

              {/* Registration & Compliance */}
              {entityType !== 'parent' && (
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: BRAND.primary }}>Registration & Compliance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {entityConfig[entityType].fields.includes('registrationNumber') && (
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Registration / License Number</label>
                        <input name="registrationNumber" value={form.registrationNumber} onChange={handleChange}
                          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                          style={{ borderColor: BRAND.border }} placeholder="REG/2024/00123" />
                      </div>
                    )}
                    {entityConfig[entityType].fields.includes('panNumber') && (
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>PAN Number</label>
                        <input name="panNumber" value={form.panNumber} onChange={handleChange}
                          className="w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2"
                          style={{ borderColor: BRAND.border }} placeholder="AABCD1234E" maxLength={10} />
                      </div>
                    )}
                    {entityConfig[entityType].fields.includes('gstNumber') && (
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>GST Number</label>
                        <input name="gstNumber" value={form.gstNumber} onChange={handleChange}
                          className="w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2"
                          style={{ borderColor: BRAND.border }} placeholder="06AABCD1234E1ZR" maxLength={15} />
                      </div>
                    )}
                    {entityConfig[entityType].fields.includes('fcraNumber') && (
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>FCRA Registration Number</label>
                        <input name="fcraNumber" value={form.fcraNumber} onChange={handleChange}
                          className="w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2"
                          style={{ borderColor: BRAND.border }} placeholder="FCRA/MH/00123" />
                      </div>
                    )}
                    {entityConfig[entityType].fields.includes('website') && (
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Website URL</label>
                        <input name="website" type="url" value={form.website} onChange={handleChange}
                          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                          style={{ borderColor: BRAND.border }} placeholder="https://yourschool.edu.in" />
                      </div>
                    )}
                    {entityConfig[entityType].fields.includes('accreditationBody') && (
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Accreditation Body (if any)</label>
                        <input name="accreditationBody" value={form.accreditationBody} onChange={handleChange}
                          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                          style={{ borderColor: BRAND.border }} placeholder="NAAC / CBSE / ICSE" />
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Address */}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: BRAND.primary }}>Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Address</label>
                    <input name="address" value={form.address} onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: BRAND.border }} placeholder="Plot 12, Sector 45" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>City</label>
                    <input name="city" value={form.city} onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: BRAND.border }} placeholder="Gurugram" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>State</label>
                    <select name="state" value={form.state} onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: BRAND.border }}>
                      <option value="">Select State</option>
                      {['Andhra Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Pincode</label>
                    <input name="pincode" value={form.pincode} onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: BRAND.border }} placeholder="122003" maxLength={6} />
                  </div>
                </div>
              </section>

              {/* Description */}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: BRAND.primary }}>About You</h3>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: BRAND.text }}>Brief Description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={4}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 resize-none"
                    style={{ borderColor: BRAND.border }}
                    placeholder={entityType === 'institute'
                      ? 'Tell us about your school — number of students, programs offered, and how you plan to use MetryxOne...'
                      : entityType === 'mentor'
                      ? 'Describe your counselling approach, client demographics, and what draws you to behavioral intelligence...'
                      : 'Describe your organization, the communities you serve, and how MetryxOne can help achieve your mission...'} />
                </div>
              </section>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
              )}

              {/* Terms */}
              <div className="text-xs text-gray-500 leading-relaxed">
                By submitting this form, you agree to MetryxOne's{' '}
                <button type="button" onClick={() => onNavigate('terms')} className="underline" style={{ color: BRAND.primary }}>Terms of Service</button>{' '}
                and{' '}
                <button type="button" onClick={() => onNavigate('privacy')} className="underline" style={{ color: BRAND.primary }}>Privacy Policy</button>.
                Your data will be handled in accordance with DPDP Act 2023 and FERPA standards.
              </div>

              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={() => setStep('select-type')} className="text-sm text-gray-500 hover:text-gray-700">← Choose a different type</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60 flex items-center gap-2"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  {submitting ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
                  ) : (
                    'Submit Application →'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && submittedRequest && (
          <div className="bg-white rounded-xl border shadow-sm p-8 text-center" style={{ borderColor: BRAND.border }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}20` }}>
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: BRAND.text }}>Application Submitted!</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto leading-relaxed">
              Thank you, <strong>{submittedRequest.entityName}</strong>. Your application has been received and is under review.
              You'll receive a confirmation email at <strong>{submittedRequest.entityEmail}</strong>.
            </p>

            {/* Application Details */}
            <div className="bg-gray-50 rounded-xl border p-5 text-left mb-6 max-w-sm mx-auto" style={{ borderColor: BRAND.border }}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Application ID</span>
                  <span className="font-mono text-xs font-medium" style={{ color: BRAND.primary }}>{submittedRequest.entityId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="capitalize font-medium">{submittedRequest.entityType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800 font-semibold">Pending Review</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Submitted</span>
                  <span className="font-medium">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-6">
              Our team typically responds within 3–5 business days. You can track your application status using your email address on this page.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => { setStep('select-type'); setForm({ entityName: '', entityEmail: '', entityPhone: '', contactPerson: '', contactDesignation: '', organizationName: '', registrationNumber: '', panNumber: '', gstNumber: '', fcraNumber: '', website: '', linkedinUrl: '', address: '', city: '', state: '', pincode: '', description: '', yearsOfExperience: '', specializations: '', accreditationBody: '', childName: '', childAge: '', schoolName: '', grade: '' }); setEntityType(null); }}
                className="px-5 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50"
                style={{ borderColor: BRAND.border, color: BRAND.text }}
              >
                Submit Another Application
              </button>
              <button
                onClick={() => onNavigate('landing')}
                className="px-5 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: BRAND.primary }}
              >
                Return to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
