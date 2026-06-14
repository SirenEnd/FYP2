import BackButton from './BackButton'
import { Monitor } from 'lucide-react'

export default function DesktopOnly({ feature = 'This feature' }) {
  return (
    <div className="container mx-auto p-6">
      <BackButton />
      <div className="bg-white rounded-lg shadow p-12 text-center max-w-md mx-auto mt-8">
        <Monitor className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Desktop Only</h2>
        <p className="text-gray-500">
          {feature} is only available on desktop. Please access this page from a desktop or laptop browser.
        </p>
      </div>
    </div>
  )
}