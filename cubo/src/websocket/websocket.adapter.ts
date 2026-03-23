import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

export class WebSocketAdapter extends IoAdapter {
  constructor(private jwtService: JwtService) {
    super();
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options);

    // Middleware global para validar JWT en el handshake
    server.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('No token provided'));
        }

        // Verificar y decodificar el JWT
        const decoded = this.jwtService.verify(token);

        // Guardar userId en socket.data de forma segura
        // decoded.sub es el username del JWT (visto en JwtStrategy)
        socket.data.userId = decoded.sub;

        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    return server;
  }
}
