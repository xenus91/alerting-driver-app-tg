import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest, { params }: { params: { tripId: string } }) {
  const tripId = Number.parseInt(params.tripId);
  const { phone, trip_identifier } = await request.json();

  try {
    console.log(`Deleting trip ${trip_identifier} for tripId: ${tripId}, phone: ${phone}`);

    await sql`BEGIN`;

    // Помечаем рейс как удаленный
    await sql`
      UPDATE trip_messages
      SET status = 'deleted'
      WHERE trip_id = ${tripId}
        AND phone = ${phone}
        AND trip_identifier = ${trip_identifier}
    `;

    // Удаляем связанные точки
    await sql`
      DELETE FROM trip_points
      WHERE trip_id = ${tripId}
        AND trip_identifier = ${trip_identifier}
    `;

    await sql`COMMIT`;

    return NextResponse.json({ success: true, message: `Trip ${trip_identifier} deleted successfully` });
  } catch (error) {
    await sql`ROLLBACK`;
    console.error("Error deleting trip:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete trip",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
