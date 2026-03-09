export default function PendingPage() {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-lg w-full text-center">
  
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⏳</span>
          </div>
  
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Solicitud recibida
          </h1>
  
          <p className="text-gray-500 text-lg mb-6">
            En breve nos contactaremos contigo para activar tu cuenta.
          </p>
  
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-6 py-4 text-yellow-700 text-sm">
            Si tienes alguna consulta puedes escribirnos directamente.
          </div>
  
          <div className="mt-8">
          <a
              href="/login"
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              Volver al inicio de sesión
            </a>
          </div>
  
        </div>
      </div>
    )
  }
