import cron from 'node-cron'
import { getUserPreferences } from './userPreferences'
import { searchFlights, formatFlightAlert } from './flightService'
import { sendAlertEmail } from './email'

let schedulerRunning = false

export function startFlightScheduler() {
  if (schedulerRunning) {
    console.log('El scheduler ya está ejecutándose')
    return
  }

  console.log('🚀 Iniciando scheduler de búsqueda de vuelos...')
  
  // Ejecutar cada 30 minutos
  cron.schedule('*/30 * * * *', async () => {
    await checkFlightAlerts()
  })

  // También ejecutar cada 2 horas para mayor frecuencia
  cron.schedule('0 */2 * * *', async () => {
    await checkFlightAlerts()
  })

  schedulerRunning = true
  console.log('✅ Scheduler iniciado - Búsquedas cada 30 minutos y cada 2 horas')
}

export function stopFlightScheduler() {
  schedulerRunning = false
  console.log('⏹️ Scheduler detenido')
}

async function checkFlightAlerts() {
  try {
    console.log(`🔍 [${new Date().toISOString()}] Ejecutando búsqueda de vuelos...`)
    
    const userPreferences = await getUserPreferences()
    
    if (!userPreferences || userPreferences.length === 0) {
      console.log('📭 No hay alertas configuradas')
      return
    }

    console.log(`📋 Procesando ${userPreferences.length} alerta${userPreferences.length > 1 ? 's' : ''}...`)

    for (const alert of userPreferences) {
      if (!alert.active) {
        console.log(`⏭️ Saltando alerta inactiva: ${alert.id}`)
        continue
      }

      try {
        console.log(`🔎 Buscando vuelos para ${alert.destination} (${alert.email})...`)
        
        // Verificar si las fechas aún son válidas
        const today = new Date()
        const departureDate = new Date(alert.departureDate)
        
        if (departureDate < today) {
          console.log(`📅 Alerta expirada para ${alert.destination} - fecha de ida pasada`)
          continue
        }

        // Buscar vuelos
        const flights = await searchFlights(alert)
        
        if (flights.length > 0) {
          console.log(`✈️ ¡Encontrados ${flights.length} vuelos baratos para ${alert.destination}!`)
          
          // Formatear mensaje
          const subject = `🎉 ¡Vuelos Baratos Encontrados! ${alert.destination} - Desde $${Math.min(...flights.map(f => f.price))}`
          const message = formatFlightAlert(flights, alert)
          
          // Enviar email
          await sendAlertEmail(alert.email, subject, message)
          console.log(`📧 Email enviado a ${alert.email}`)
          
        } else {
          console.log(`😔 No se encontraron vuelos baratos para ${alert.destination} por debajo de $${alert.priceThreshold}`)
        }

      } catch (error) {
        console.error(`❌ Error procesando alerta ${alert.id}:`, error)
      }
    }

    console.log(`✅ Búsqueda completada a las ${new Date().toLocaleTimeString('es-ES')}`)

  } catch (error) {
    console.error('❌ Error en checkFlightAlerts:', error)
  }
}

// Función para ejecutar una búsqueda manual (útil para testing)
export async function runManualSearch() {
  console.log('🔧 Ejecutando búsqueda manual...')
  await checkFlightAlerts()
}

// Función para obtener el estado del scheduler
export function getSchedulerStatus() {
  return {
    running: schedulerRunning,
    nextRun: schedulerRunning ? 'Cada 30 minutos y cada 2 horas' : 'Detenido',
    timestamp: new Date().toISOString()
  }
}
