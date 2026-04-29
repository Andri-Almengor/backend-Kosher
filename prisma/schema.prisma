generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Rol {
  id          Int     @id @default(autoincrement())
  nombre      String  @unique
  descripcion String?

  usuarios Usuario[]

  @@map("roles")
}

model Usuario {
  id           Int     @id @default(autoincrement())
  nombre       String
  email        String  @unique
  passwordHash String  @map("password_hash")
  rolId        Int     @map("rol_id")
  rol          Rol     @relation(fields: [rolId], references: [id])
  activo       Boolean @default(true)

  noticias          Noticia[]
  ForoHilo          ForoHilo[]
  ForoRespuesta     ForoRespuesta[]
  ForoRespuestaLike ForoRespuestaLike[]
  eventosCreados    Evento[]            @relation("EventosCreados")

  @@map("usuarios")
}

model Producto {
  id                Int      @id @default(autoincrement())

  catGeneral        String   @map("cat_general")
  catGeneralEn      String?  @map("cat_general_en")
  categoria1        String   @map("categoria_1")
  categoria1En      String?  @map("categoria_1_en")
  fabricanteMarca   String   @map("fabricante_marca")
  fabricanteMarcaEn String?  @map("fabricante_marca_en")
  nombre            String   @map("nombre")
  nombreEn          String?  @map("nombre_en")

  certifica         String?  @map("certifica")
  certificaEn       String?  @map("certifica_en")
  sello             String?  @map("sello")
  selloEn           String?  @map("sello_en")

  atributo1         String?  @map("atributo_1")
  atributo1En       String?  @map("atributo_1_en")
  atributo2         String?  @map("atributo_2")
  atributo2En       String?  @map("atributo_2_en")
  atributo3         String?  @map("atributo_3")
  atributo3En       String?  @map("atributo_3_en")

  tienda            String?  @map("tienda")
  tiendaEn          String?  @map("tienda_en")

  fotoProducto      String?  @map("foto_producto")
  fotoSello1        String?  @map("foto_sello_1")
  fotoSello2        String?  @map("foto_sello_2")

  creadoEn          DateTime @default(now()) @map("creado_en")
  actualizadoEn     DateTime @updatedAt @map("actualizado_en")

  hilos ForoHilo[]

  @@index([catGeneral])
  @@index([categoria1])
  @@index([fabricanteMarca])
  @@index([nombre])
  @@map("productos")
}


model ForoCategoria {
  id          Int      @id @default(autoincrement())
  nombre      String   @unique
  descripcion String?
  creadoEn    DateTime @default(now()) @map("creado_en")

  hilos ForoHilo[]

  @@map("foro_categorias")
}

model ForoHilo {
  id            Int      @id @default(autoincrement())
  categoriaId   Int      @map("categoria_id")
  usuarioId     Int      @map("usuario_id")
  titulo        String
  contenido     String
  productoId    Int?     @map("producto_id")
  esCerrado     Boolean?  @default(false) @map("es_cerrado")
  creadoEn      DateTime @default(now()) @map("creado_en")
  actualizadoEn DateTime @default(now()) @map("actualizado_en")

  categoria  ForoCategoria   @relation(fields: [categoriaId], references: [id])
  usuario    Usuario         @relation(fields: [usuarioId], references: [id])
  producto   Producto?       @relation(fields: [productoId], references: [id])
  respuestas ForoRespuesta[]

  @@map("foro_hilos")
}

model ForoRespuesta {
  id            Int      @id @default(autoincrement())
  hiloId        Int      @map("hilo_id")
  usuarioId     Int      @map("usuario_id")
  contenido     String
  creadoEn      DateTime @default(now()) @map("creado_en")
  actualizadoEn DateTime @default(now()) @map("actualizado_en")
  esEliminado   Boolean  @default(false) @map("es_eliminado")

  hilo    ForoHilo            @relation(fields: [hiloId], references: [id])
  usuario Usuario             @relation(fields: [usuarioId], references: [id])
  likes   ForoRespuestaLike[]

  @@map("foro_respuestas")
}

model ForoRespuestaLike {
  id          Int      @id @default(autoincrement())
  respuestaId Int      @map("respuesta_id")
  usuarioId   Int      @map("usuario_id")
  creadoEn    DateTime @default(now()) @map("creado_en")

  respuesta ForoRespuesta @relation(fields: [respuestaId], references: [id])
  usuario   Usuario       @relation(fields: [usuarioId], references: [id])

  @@unique([respuestaId, usuarioId], name: "uq_like_unico")
  @@map("foro_respuestas_likes")
}

enum NoticiaDestino {
  NOVEDADES
  ANUNCIANTES
}

model Noticia {
  id            Int      @id @default(autoincrement())
  titulo        String
  contenido     String?
  imageUrl      String?  @map("image_url")
  fileUrl       String?  @map("file_url")

  destino       NoticiaDestino @default(NOVEDADES) @map("destino")
  activo        Boolean   @default(true)
  notifyUsers   Boolean   @default(false) @map("notify_users")
  restauranteId Int?      @map("restaurante_id")

  creadoEn      DateTime @default(now()) @map("creado_en")
  actualizadoEn DateTime @default(now()) @map("actualizado_en")

  autorId Int     @map("autor_id")
  autor   Usuario @relation(fields: [autorId], references: [id])
  restaurante RestauranteComercio? @relation(fields: [restauranteId], references: [id])

  @@index([destino])
  @@index([restauranteId])
  @@map("noticias")
}


model EventoSuscripcion {
  id           Int      @id @default(autoincrement())
  eventoId     Int      @map("evento_id")
  deviceId     String   @map("device_id")
  minutosAntes Int      @default(1440) @map("minutos_antes")
  creadoEn     DateTime @default(now()) @map("creado_en")

  evento Evento @relation(fields: [eventoId], references: [id], onDelete: Cascade)

  @@unique([eventoId, deviceId], name: "uq_evento_device")
  @@map("evento_suscripciones")
}

model Evento {
  id          Int       @id @default(autoincrement())
  titulo      String
  descripcion String?
  ubicacion   String?
  inicio      DateTime
  fin         DateTime?
  todoElDia   Boolean   @default(false) @map("todo_el_dia")

  creadoEn      DateTime @default(now()) @map("creado_en")
  actualizadoEn DateTime @updatedAt @map("actualizado_en")

  creadoPorId Int?     @map("creado_por_id")
  creadoPor   Usuario? @relation("EventosCreados", fields: [creadoPorId], references: [id])

  suscripciones EventoSuscripcion[]

  @@map("eventos")
}


model RestauranteNombreOption {
  id        Int      @id @default(autoincrement())
  nombreEs  String   @unique @map("nombre_es")
  nombreEn  String?  @map("nombre_en")
  creadoEn  DateTime @default(now()) @map("creado_en")
  actualizadoEn DateTime @updatedAt @map("actualizado_en")

  @@map("restaurante_nombre_options")
}

model TipoComercioOption {
  id        Int      @id @default(autoincrement())
  nombreEs  String   @unique @map("nombre_es")
  nombreEn  String?  @map("nombre_en")
  creadoEn  DateTime @default(now()) @map("creado_en")
  actualizadoEn DateTime @updatedAt @map("actualizado_en")

  @@map("tipo_comercio_options")
}

model RestauranteComercio {
  id              Int      @id @default(autoincrement())
  imageUrl        String?  @map("image_url")
  nombreEs        String   @map("nombre_es")
  nombreEn        String?  @map("nombre_en")
  tipoEs          String   @map("tipo_es")
  tipoEn          String?  @map("tipo_en")
  ubicacionEs     String?  @map("ubicacion_es")
  ubicacionEn     String?  @map("ubicacion_en")
  acercaDeEs      String?  @map("acerca_de_es")
  acercaDeEn      String?  @map("acerca_de_en")
  horarioEs       String?  @map("horario_es")
  horarioEn       String?  @map("horario_en")
  telefono        String?  @map("telefono")
  descripTelefonoEs String? @map("descrip_telefono_es")
  descripTelefonoEn String? @map("descrip_telefono_en")
  whatsapp        String?  @map("whatsapp")
  descripWhatsappEs String? @map("descrip_whatsapp_es")
  descripWhatsappEn String? @map("descrip_whatsapp_en")
  correo          String?  @map("correo")
  descripCorreoEs String?  @map("descrip_correo_es")
  descripCorreoEn String?  @map("descrip_correo_en")
  contactoEs      String?  @map("contacto_es")
  contactoEn      String?  @map("contacto_en")
  direccionEs     String?  @map("direccion_es")
  direccionEn     String?  @map("direccion_en")
  direccionLink   String?  @map("direccion_link")
  activo          Boolean  @default(true)
  creadoEn        DateTime @default(now()) @map("creado_en")
  actualizadoEn   DateTime @updatedAt @map("actualizado_en")

  @@index([nombreEs])
  noticias        Noticia[]

  @@index([tipoEs])
  @@index([activo])
  @@map("restaurantes_comercios")
}



model UiSetting {
  id           Int      @id @default(autoincrement())
  key          String   @unique
  value        Json?
  activo       Boolean  @default(true)
  creadoEn     DateTime @default(now()) @map("creado_en")
  actualizadoEn DateTime @updatedAt @map("actualizado_en")

  @@map("ui_settings")
}
