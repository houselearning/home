import asyncio
import websockets
import json
import time

# Dictionary to store active players and their data
# In a real application, this would typically be backed by a persistent database
active_players = {}

async def register_player(websocket):
    """Registers a new player connection."""
    # Generate a unique ID for the player (or use an ID from client if available)
    # For this example, the client sends its own unique ID
    player_id = None
    while player_id is None:
        try:
            # Wait for the first message from the client to get their ID
            initial_message = await websocket.recv()
            data = json.loads(initial_message)
            if data.get('type') == 'player_update' and 'id' in data:
                player_id = data['id']
                # Store initial player data
                active_players[player_id] = {
                    'position': data.get('position', {'x': 0, 'y': 0, 'z': 0}),
                    'rotation': data.get('rotation', {'x': 0, 'y': 0, 'z': 0, 'w': 1}),
                    'color': data.get('color', '#FFFFFF'),
                    'name': data.get('name', f'Player_{player_id[:4]}'),
                    'last_active': time.time() # Track last active time
                }
                print(f"Player {player_id} registered.")
                # Notify all clients that a new player joined
                await broadcast_player_joined(player_id)
                return player_id
            else:
                print(f"Received unexpected initial message: {data}")
                # Close connection if initial message is not valid
                await websocket.close()
                return None
        except websockets.exceptions.ConnectionClosedOK:
            print("Initial connection closed before ID received.")
            return None
        except Exception as e:
            print(f"Error during player registration: {e}")
            await websocket.close()
            return None


async def unregister_player(player_id):
    """Unregisters a player connection."""
    if player_id in active_players:
        del active_players[player_id]
        print(f"Player {player_id} unregistered.")
        # Notify all clients that a player left
        await broadcast_player_left(player_id)

async def cleanup_inactive_players():
    """Removes players who haven't sent updates recently."""
    while True:
        inactive_threshold = 5  # seconds
        current_time = time.time()
        to_remove = []
        for player_id, data in active_players.items():
            if current_time - data['last_active'] > inactive_threshold:
                to_remove.append(player_id)

        for player_id in to_remove:
            await unregister_player(player_id) # Call unregister to also broadcast removal
        await asyncio.sleep(1) # Check every second

async def handle_player_updates(websocket, player_id):
    """Handles incoming messages from a client (player updates)."""
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get('type') == 'player_update' and data.get('id') == player_id:
                active_players[player_id]['position'] = data.get('position', active_players[player_id]['position'])
                active_players[player_id]['rotation'] = data.get('rotation', active_players[player_id]['rotation'])
                active_players[player_id]['color'] = data.get('color', active_players[player_id]['color'])
                active_players[player_id]['name'] = data.get('name', active_players[player_id]['name'])
                active_players[player_id]['last_active'] = time.time() # Update last active time

                # Broadcast current state of all players to all connected clients
                await broadcast_player_state()
            else:
                print(f"Received invalid message from {player_id}: {message}")
    except websockets.exceptions.ConnectionClosedOK:
        print(f"Player {player_id} disconnected normally.")
    except Exception as e:
        print(f"Error handling messages for {player_id}: {e}")
    finally:
        await unregister_player(player_id)

async def broadcast_player_state():
    """Sends the current state of all active players to all connected clients."""
    if not websockets.connected_websockets:
        return # No connected clients to broadcast to

    # Filter out sensitive data if any, and prepare for sending
    players_to_send = {
        pid: {k: v for k, v in pdata.items() if k != 'last_active'}
        for pid, pdata in active_players.items()
    }
    message = json.dumps({"type": "player_update", "players": players_to_send})
    await asyncio.gather(*[ws.send(message) for ws in websockets.connected_websockets])

async def broadcast_player_joined(player_id):
    """Notifies all connected clients that a new player has joined."""
    if not websockets.connected_websockets:
        return
    message = json.dumps({"type": "player_joined", "id": player_id})
    await asyncio.gather(*[ws.send(message) for ws in websockets.connected_websockets])

async def broadcast_player_left(player_id):
    """Notifies all connected clients that a player has left."""
    if not websockets.connected_websockets:
        return
    message = json.dumps({"type": "player_left", "id": player_id})
    await asyncio.gather(*[ws.send(message) for ws in websockets.connected_websockets])


async def main():
    """Main function to start the WebSocket server."""
    # Start the server on localhost, port 8765
    server = await websockets.serve(
        lambda ws, path: handle_player_updates(ws, (lambda: asyncio.create_task(register_player(ws)))()),
        "localhost", 8765
    )
    print("WebSocket server started on ws://localhost:8765")

    # Start the inactive player cleanup task
    asyncio.create_task(cleanup_inactive_players())

    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
