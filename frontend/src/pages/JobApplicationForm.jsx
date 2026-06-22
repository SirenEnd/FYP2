import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const POSITIONS = [
  { key: 'KITCHEN_STAFF', label: 'Kitchen Staff', icon: '👨‍🍳' },
  { key: 'SERVICE_CREW', label: 'Service Crew', icon: '🍽️' }
]

const currentYear = new Date().getFullYear()

const JobApplicationForm = () => {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    position: 'KITCHEN_STAFF',
    typhoidVaccinated: null, // true | false | null (not yet answered)
    vaccinationYear: ''
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleVaccinationChoice = (value) => {
    update('typhoidVaccinated', value)
    if (!value) update('vaccinationYear', '')
  }

  const validate = () => {
    if (!form.name.trim()) return 'Please enter your full name'
    if (!form.email.trim()) return 'Please enter your email address'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address'
    if (!form.phone.trim()) return 'Please enter your phone number'
    if (!form.address.trim()) return 'Please enter your address'
    if (form.typhoidVaccinated === null) return 'Please let us know if you are vaccinated against typhoid'
    if (form.typhoidVaccinated) {
      const year = parseInt(form.vaccinationYear)
      if (!form.vaccinationYear || isNaN(year) || year < 1950 || year > currentYear) {
        return `Please enter a valid vaccination year between 1950 and ${currentYear}`
      }
    }
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await api.post('/job-applications', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        position: form.position,
        typhoidVaccinated: form.typhoidVaccinated,
        vaccinationYear: form.typhoidVaccinated ? parseInt(form.vaccinationYear) : null
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-md max-w-md w-full p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
          <p className="text-gray-500 text-sm mb-6">
            Thanks for applying to join our crew. Our team will review your application and reach out if there's a match.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-md max-w-lg w-full p-8">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-sm text-gray-400 hover:text-gray-600 mb-4"
        >
          ← Back to Login
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Join Our Crew</h1>
        <p className="text-sm text-gray-500 mb-6">Fill out the form below to apply for a position with us.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Amir Hakim"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="01X-XXXXXXX"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your home address"
            />
          </div>

          {/* Position toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Applying As</label>
            <div className="grid grid-cols-2 gap-2">
              {POSITIONS.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => update('position', p.key)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all"
                  style={{
                    borderColor: form.position === p.key ? '#2563eb' : '#e5e7eb',
                    background: form.position === p.key ? '#eff6ff' : '#fff',
                    color: form.position === p.key ? '#2563eb' : '#6b7280'
                  }}
                >
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vaccination toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Are you vaccinated against Typhoid?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Yes', value: true },
                { label: 'No', value: false }
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.label}
                  onClick={() => handleVaccinationChoice(opt.value)}
                  className="px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all"
                  style={{
                    borderColor: form.typhoidVaccinated === opt.value ? '#2563eb' : '#e5e7eb',
                    background: form.typhoidVaccinated === opt.value ? '#eff6ff' : '#fff',
                    color: form.typhoidVaccinated === opt.value ? '#2563eb' : '#6b7280'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.typhoidVaccinated && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year Vaccinated</label>
              <input
                type="number"
                min="1950"
                max={currentYear}
                value={form.vaccinationYear}
                onChange={(e) => update('vaccinationYear', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`e.g. ${currentYear - 2}`}
              />
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
          >
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default JobApplicationForm