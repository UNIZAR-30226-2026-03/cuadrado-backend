-- CreateTable
CREATE TABLE "USERS" (
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "cubitos" INTEGER NOT NULL,
    "elo_rating" INTEGER NOT NULL,
    "rank_placement" INTEGER NOT NULL,
    "games_played" INTEGER NOT NULL,
    "games_won" INTEGER NOT NULL,
    "num_players_played" INTEGER NOT NULL,
    "num_players_won" INTEGER NOT NULL,
    "settings" JSONB,

    CONSTRAINT "USERS_pkey" PRIMARY KEY ("username")
);

-- CreateTable
CREATE TABLE "GAME_STATE" (
    "name" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "habilidades_activadas" INTEGER[],
    "discarded_cards" INTEGER[],
    "turn" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GAME_STATE_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "PAUSED_GAME_PLAYERS" (
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "turn_order" INTEGER NOT NULL,
    "cards" INTEGER[],
    "habilidades" INTEGER[],

    CONSTRAINT "PAUSED_GAME_PLAYERS_pkey" PRIMARY KEY ("room_id","user_id")
);

-- CreateTable
CREATE TABLE "SKINS" (
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "SKINS_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "USER_SKINS" (
    "user_id" TEXT NOT NULL,
    "skin_id" TEXT NOT NULL,

    CONSTRAINT "USER_SKINS_pkey" PRIMARY KEY ("user_id","skin_id")
);

-- AddForeignKey
ALTER TABLE "GAME_STATE" ADD CONSTRAINT "GAME_STATE_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "USERS"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PAUSED_GAME_PLAYERS" ADD CONSTRAINT "PAUSED_GAME_PLAYERS_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "GAME_STATE"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PAUSED_GAME_PLAYERS" ADD CONSTRAINT "PAUSED_GAME_PLAYERS_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USERS"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "USER_SKINS" ADD CONSTRAINT "USER_SKINS_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USERS"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "USER_SKINS" ADD CONSTRAINT "USER_SKINS_skin_id_fkey" FOREIGN KEY ("skin_id") REFERENCES "SKINS"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
