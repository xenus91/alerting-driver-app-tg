import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { DeleteTripButton } from "@/components/delete-trip-button"
import { TripSubscriptionButton } from "@/components/trip-subscription-button"

const getTrips = async () => {
  try {
    const trips = await db.trip.findMany({
      orderBy: {
        createdAt: "desc",
      },
    })

    return trips
  } catch (error) {
    console.log(error)
    return []
  }
}

const TripsPage = async () => {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/")
  }

  const trips = await getTrips()

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-4">Trips</h1>
      {trips.length === 0 ? (
        <p>No trips found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {trips.map((trip) => (
            <div key={trip.id} className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-xl font-semibold mb-2">{trip.name}</h2>
              <p className="text-gray-600 mb-4">{trip.description}</p>
              <div className="flex justify-between items-center">
                <a
                  href={`/trips/${trip.id}`}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Details
                </a>
                <div className="flex">
                  <DeleteTripButton tripId={trip.id} />
                  <TripSubscriptionButton
                    tripId={trip.id}
                    userTelegramId={session.user?.telegram_id}
                    className="ml-2"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TripsPage
