-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_created_by_id_fkey";

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
