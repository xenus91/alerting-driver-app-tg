import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import sql from 'sql-template-strings';

export const config = {
  runtime: 'edge',
};

async function queryDatabase(query: any) {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const client = await pool.connect();
    const result = await client.query(query);
    client.release();
    return result.rows;
  } catch (error) {
    console.error('Database query failed:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trip_id, message_id, response, user_id } = body;

    if (!trip_id || !message_id || !response || !user_id) {
      return new NextResponse(
        JSON.stringify({ message: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert the campaign response into the database
    const insertQuery = sql`
      INSERT INTO trip_message_responses (trip_id, message_id, response, user_id, created_at)
      VALUES (${trip_id}, ${message_id}, ${response}, ${user_id}, NOW())
      RETURNING *;
    `;

    const insertedResponse = await queryDatabase(insertQuery);

    return new NextResponse(JSON.stringify({ data: insertedResponse }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing campaign response:', error);
    return new NextResponse(
      JSON.stringify({ message: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const trip_id = searchParams.get('trip_id')
    const message_id = searchParams.get('message_id')
    const user_id = searchParams.get('user_id')

    if (!trip_id || !message_id || !user_id) {
        return new NextResponse(
          JSON.stringify({ message: 'Missing required query parameters' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

    const selectQuery = sql`
        SELECT * FROM trip_message_responses
        WHERE trip_id = ${trip_id} AND message_id = ${message_id} AND user_id = ${user_id};
    `;

    const responses = await queryDatabase(selectQuery);

    return new NextResponse(JSON.stringify({ data: responses }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching campaign responses:', error);
    return new NextResponse(
      JSON.stringify({ message: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
