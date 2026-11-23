/** Vietnamese names and texts of game data (units, buildings, technologies, campaign, progression). */
export const VI_DATA: Record<string, string> = {
  // ------------------------------------------------------------ units
  Rifleman: 'Lính súng trường',
  'Cheap infantry. Strong vs infantry, weak vs armor.': 'Bộ binh rẻ. Mạnh với bộ binh, yếu với xe bọc thép.',
  'Anti-Tank Soldier': 'Lính chống tăng',
  'Rocket infantry. Strong vs vehicles and helicopters.': 'Bộ binh mang rocket. Mạnh với xe và trực thăng.',
  'Recon Vehicle': 'Xe trinh sát',
  'Fast light vehicle for scouting and raiding.': 'Xe nhẹ, nhanh, dùng để trinh sát và đánh tập kích.',
  APC: 'Xe thiết giáp chở quân',
  'Armored carrier with heavy machine gun. Carries 5 infantry. Anti-infantry, light anti-air.':
    'Xe bọc thép có súng máy hạng nặng. Chở 5 bộ binh. Chống bộ binh, phòng không nhẹ.',
  'Main Battle Tank': 'Xe tăng chủ lực',
  'Core battle tank. Strong vs vehicles and buildings.': 'Xe tăng chủ lực. Mạnh với xe và công trình.',
  'Heavy Tank': 'Xe tăng hạng nặng',
  'Slow, heavily armored tank. Requires Research Center.': 'Xe tăng chậm, giáp rất dày. Cần Trung tâm nghiên cứu.',
  'Mobile Artillery': 'Pháo tự hành',
  'Long range splash artillery. Vulnerable up close.': 'Pháo tầm xa, nổ lan. Yếu khi bị áp sát.',
  'Attack Helicopter': 'Trực thăng tấn công',
  'Fast air unit. Flies over terrain. Strong vs armor.': 'Máy bay nhanh, bay qua mọi địa hình. Mạnh với xe bọc thép.',
  'Recon Drone': 'Drone trinh sát',
  'Unarmed drone with very large vision radius.': 'Drone không vũ khí, tầm nhìn rất rộng.',
  Sniper: 'Lính bắn tỉa',
  'Long-range marksman. Picks off infantry from far away; useless against armor.':
    'Xạ thủ tầm xa. Hạ bộ binh từ rất xa; vô dụng với xe bọc thép.',
  Medic: 'Quân y',
  'Unarmed. Heals nearby wounded infantry.': 'Không vũ khí. Chữa bộ binh bị thương ở gần.',
  Engineer: 'Công binh',
  'Unarmed. Repairs nearby vehicles and buildings for free.': 'Không vũ khí. Sửa xe và công trình ở gần miễn phí.',
  'Ranger (Special Forces)': 'Biệt kích (Đặc nhiệm)',
  'Western Alliance only. Elite, fast infantry with heavy rifles.':
    'Chỉ Liên minh phương Tây. Bộ binh tinh nhuệ, nhanh, súng mạnh.',
  'Rocket Launcher (MLRS)': 'Pháo phản lực (MLRS)',
  'Eastern Legion only. Saturation rocket artillery with a wide, incendiary blast.':
    'Chỉ Quân đoàn phương Đông. Pháo rocket bắn trùm, nổ rộng và gây cháy.',
  Gunship: 'Trực thăng vũ trang',
  'Pacific Technology only. Heavy helicopter with rotary cannons, shreds infantry.':
    'Chỉ Công nghệ Thái Bình Dương. Trực thăng nặng với pháo quay, càn quét bộ binh.',
  'Light Tank': 'Xe tăng hạng nhẹ',
  'Desert Corps only. Fast raider tank for flanking and harassment.':
    'Chỉ Quân đoàn Sa mạc. Xe tăng nhanh để đánh vu hồi và quấy rối.',
  'Infantry Fighting Vehicle': 'Xe chiến đấu bộ binh',
  'Iron Republic only. Armored autocannon carrier, also fires at aircraft.':
    'Chỉ Cộng hòa Sắt. Xe bọc thép có pháo tự động, bắn được cả máy bay.',
  'Transport Helicopter': 'Trực thăng vận tải',
  'Unarmed. Flies 6 infantry over any terrain; unload anywhere on open ground.':
    'Không vũ khí. Chở 6 bộ binh bay qua mọi địa hình; thả quân ở bất kỳ chỗ đất trống nào.',
  'Fighter Jet': 'Tiêm kích',
  'Very fast air-superiority jet. Hunts helicopters, drones and bombers; cannot attack the ground.':
    'Máy bay chiến đấu rất nhanh, giành ưu thế trên không. Săn trực thăng, drone và oanh tạc cơ; không đánh được mặt đất.',
  Bomber: 'Oanh tạc cơ',
  'Heavy bomber: flies over the target and drops a devastating bomb load. Needs fighter or SAM cover.':
    'Máy bay ném bom hạng nặng: bay qua mục tiêu và trút bom cực mạnh. Cần tiêm kích hoặc SAM yểm trợ.',
  'Mobile Command Vehicle': 'Xe chỉ huy cơ động (MCV)',
  'Unarmed. Deploys into a Headquarters where it stands (U) to start a forward base anywhere.':
    'Không vũ khí. Triển khai thành Sở chỉ huy ngay tại chỗ (U) để lập căn cứ tiền tuyến ở bất kỳ đâu.',
  'Long-range Missile System': 'Hệ thống tên lửa tầm xa',
  'Strikes ground targets 20 tiles away with incendiary missiles. Needs spotters (radar, scouts) to see that far; helpless up close.':
    'Bắn tên lửa gây cháy vào mục tiêu mặt đất cách 20 ô. Cần radar / trinh sát để thấy xa; không tự vệ được khi bị áp sát.',
  'Patrol Boat': 'Tàu tuần tra',
  'Fast gunboat. Machine guns hit infantry, light vehicles and aircraft; depth charges and sonar hunt submarines. Water only.':
    'Pháo hạm nhanh. Súng máy bắn bộ binh, xe nhẹ và máy bay; bom chìm và sonar săn tàu ngầm. Chỉ đi trên nước.',
  'Landing Craft': 'Tàu đổ bộ',
  'Unarmed transport: 6 seats (infantry 1, vehicle 3). Unload (U) next to a beach.':
    'Tàu chở quân không vũ khí: 6 chỗ (bộ binh 1, xe 3). Thả quân (U) cạnh bãi biển.',
  Submarine: 'Tàu ngầm',
  'Hidden under water; torpedoes sink ships. Revealed by nearby sonar (Patrol Boats) or when it fires.':
    'Ẩn dưới nước; ngư lôi đánh chìm tàu. Bị lộ khi có sonar (Tàu tuần tra) ở gần hoặc khi phóng.',
  Destroyer: 'Tàu khu trục',
  'Armored warship. Its deck gun shells the coast from 13 tiles away. Requires Research Center.':
    'Chiến hạm bọc thép. Pháo boong nã vào bờ từ cách 13 ô. Cần Trung tâm nghiên cứu.',

  // ------------------------------------------------------------ buildings
  Headquarters: 'Sở chỉ huy',
  'Command center. Small credit income. Losing it is fatal in Decapitation.':
    'Trung tâm chỉ huy. Có ít thu nhập. Mất nó là thua ở chế độ Chặt đầu.',
  'Power Plant': 'Nhà máy điện',
  'Generates 100 power.': 'Sản xuất 100 điện.',
  'Resource Extractor': 'Máy khai thác',
  'Extracts credits from nearby ore. Must be placed next to an ore field.':
    'Khai thác tiền từ quặng gần đó. Phải đặt cạnh mỏ quặng.',
  Barracks: 'Doanh trại',
  'Trains infantry.': 'Huấn luyện bộ binh.',
  'War Factory': 'Nhà máy chiến xa',
  'Builds armored vehicles and artillery.': 'Sản xuất xe bọc thép và pháo.',
  Airfield: 'Sân bay',
  'Naval Yard': 'Xưởng tàu',
  'Shipyard on the shore. Builds Patrol Boats and Destroyers that sail on water.':
    'Xưởng đóng tàu ven bờ. Sản xuất Tàu tuần tra và Tàu khu trục đi trên nước.',
  'Builds helicopters and drones.': 'Sản xuất trực thăng, máy bay và drone.',
  'Research Center': 'Trung tâm nghiên cứu',
  'Unlocks Heavy Tank and Mobile Artillery.': 'Mở khóa xe tăng hạng nặng, pháo tự hành và công nghệ.',
  'Defense Turret': 'Tháp pháo phòng thủ',
  'Anti-ground cannon turret.': 'Tháp pháo bắn mục tiêu mặt đất.',
  'SAM Site': 'Bệ tên lửa phòng không (SAM)',
  'Surface-to-air missile launcher.': 'Bệ phóng tên lửa đất đối không.',
  'Radar Station': 'Trạm radar',
  'Huge vision radius (20 tiles) around your base: see attacks coming.':
    'Tầm nhìn rất rộng (20 ô) quanh căn cứ: thấy địch tới từ xa.',
  Wall: 'Tường',
  'Cheap, sturdy concrete block that blocks ground units. Shift+click to place several.':
    'Khối bê tông rẻ, chắc, chặn quân mặt đất. Giữ Shift + bấm để đặt nhiều.',
  'Missile Launcher': 'Bệ tên lửa',
  'Long-range anti-ground missile battery. Outranges tanks; cannot hit aircraft.':
    'Bệ tên lửa tầm xa đánh mặt đất. Bắn xa hơn xe tăng; không bắn được máy bay.',
  Bunker: 'Lô cốt',
  'Fortified bunker for up to 4 infantry, who fire out safely (damage grows with the garrison). Empty bunkers do not shoot.':
    'Lô cốt cho tối đa 4 bộ binh bắn ra an toàn (càng nhiều quân càng mạnh). Lô cốt trống không bắn.',

  'Field Hospital': 'Bệnh viện dã chiến',
  'Western Alliance only. Heals every friendly infantry unit within 6 tiles.':
    'Chỉ Liên minh phương Tây. Chữa mọi bộ binh phe ta trong 6 ô.',
  'Howitzer Emplacement': 'Trận địa lựu pháo',
  'Eastern Legion only. Fixed heavy artillery: shells ground targets up to 13 tiles away. Cannot fire up close.':
    'Chỉ Quân đoàn phương Đông. Pháo hạng nặng cố định: bắn mục tiêu mặt đất xa tới 13 ô. Không bắn được ở gần.',
  'Repair Bay': 'Trạm sửa chữa',
  'Pacific Technology only. Repairs every friendly vehicle, aircraft and building within 5 tiles.':
    'Chỉ Công nghệ Thái Bình Dương. Sửa mọi xe, máy bay và công trình phe ta trong 5 ô.',
  'Oil Derrick': 'Giàn khoan dầu',
  'Desert Corps only. Pumps 4 credits/s anywhere, no ore needed, never runs dry.':
    'Chỉ Quân đoàn Sa mạc. Bơm 4 tiền / giây ở bất kỳ đâu, không cần quặng, không bao giờ cạn.',
  Bastion: 'Pháo đài',
  'Iron Republic only. Massively armored fortress with a long-barrelled cannon.':
    'Chỉ Cộng hòa Sắt. Pháo đài bọc giáp cực dày với khẩu pháo nòng dài.',

  // ------------------------------------------------------------ research
  'Composite Armor': 'Giáp composite',
  'Vehicles and artillery gain +20% max HP.': 'Xe và pháo +20% máu tối đa.',
  'Improved Munitions': 'Đạn dược cải tiến',
  'All units and defenses deal +15% damage.': 'Mọi unit và công trình phòng thủ +15% sát thương.',
  'Advanced Optics': 'Quang học tiên tiến',
  'Units gain +25% vision radius.': 'Unit +25% tầm nhìn.',
  'Efficient Extraction': 'Khai thác hiệu quả',
  'Resource Extractors produce +30% credits.': 'Máy khai thác cho +30% tiền.',
  'Combat Medkits': 'Túi cứu thương chiến trường',
  'Western Alliance: infantry gain +25% max HP.': 'Liên minh phương Tây: bộ binh +25% máu tối đa.',
  'Reactive Armor': 'Giáp phản ứng nổ',
  'Eastern Legion: heavy-armored units take 15% less damage.': 'Quân đoàn phương Đông: unit giáp nặng nhận ít hơn 15% sát thương.',
  'Nano Repair': 'Tự sửa nano',
  'Pacific Technology: vehicles and aircraft regenerate 0.5% HP per second.':
    'Công nghệ Thái Bình Dương: xe và máy bay hồi 0,5% máu mỗi giây.',
  'Turbo Engines': 'Động cơ tăng áp',
  'Desert Corps: vehicles and artillery move 15% faster.': 'Quân đoàn Sa mạc: xe và pháo đi nhanh hơn 15%.',
  'Fortified Structures': 'Công trình gia cố',
  'Iron Republic: all buildings gain +25% max HP.': 'Cộng hòa Sắt: mọi công trình +25% máu tối đa.',

  // ------------------------------------------------------------ factions & AI personalities
  'Western Alliance': 'Liên minh phương Tây',
  'Balanced Warfare': 'Chiến tranh cân bằng',
  'Eastern Legion': 'Quân đoàn phương Đông',
  'Heavy Firepower': 'Hỏa lực hạng nặng',
  'Pacific Technology': 'Công nghệ Thái Bình Dương',
  'Advanced Technology': 'Công nghệ tiên tiến',
  'Desert Corps': 'Quân đoàn Sa mạc',
  'Rapid Assault': 'Tấn công thần tốc',
  'Iron Republic': 'Cộng hòa Sắt',
  'Defensive Warfare': 'Chiến tranh phòng thủ',
  'Aggressive. Early attacks with fast production.': 'Hung hăng. Tấn công sớm, sản xuất nhanh.',
  'Defensive. Strong base and late counter-attacks.': 'Phòng thủ. Căn cứ vững, phản công muộn.',
  'Air force and reconnaissance.': 'Không quân và trinh sát.',
  'Intelligence and fast raids.': 'Tình báo và đánh tập kích nhanh.',
  'Balanced army, large-scale attacks.': 'Quân cân bằng, tấn công quy mô lớn.',

  // ------------------------------------------------------------ map descriptions
  'Randomly generated valley battlefield (seed 1). Mirrored for fairness.':
    'Chiến trường thung lũng tạo ngẫu nhiên (seed 1). Đối xứng để công bằng.',
  'Open desert with rocky ridges and rich ore fields. Tank battles and territorial control.':
    'Sa mạc trống trải với dải đá và mỏ quặng giàu. Đấu xe tăng và tranh giành lãnh thổ.',
  'Dense modern city with narrow streets, parks and industrial ore lots. Infantry and ambushes.':
    'Thành phố hiện đại dày đặc, đường hẹp, công viên và bãi quặng công nghiệp. Bộ binh và phục kích.',
  'Green valley split by a winding river. Three bridges and two shallow fords decide every battle.':
    'Thung lũng xanh bị chia đôi bởi dòng sông uốn lượn. Ba cây cầu và hai chỗ lội quyết định mọi trận đánh.',
  'A walled hill town on a central plateau with rich ore, reachable only through four narrow passes. Hold the passes, take the town.':
    'Thị trấn có tường trên cao nguyên giữa bản đồ, quặng giàu, chỉ vào được qua bốn đèo hẹp. Giữ đèo, chiếm thị trấn.',
  'Frozen plains with pine groves, icy lakes and a rocky ridge. Long sightlines, few chokepoints.':
    'Đồng bằng băng giá với rừng thông, hồ băng và dải đá. Tầm nhìn xa, ít điểm nghẽn.',
  'Thick woods split by trails and clearings. Ambushes everywhere; armies must use the paths.':
    'Rừng rậm bị chia bởi đường mòn và khoảng trống. Phục kích khắp nơi; quân phải đi theo đường.',
  'Island bases joined by narrow sand causeways around a central isle. Aircraft rule; ground armies queue at the crossings.':
    'Căn cứ trên các đảo nối bằng đường đắp cát hẹp quanh đảo giữa. Máy bay làm chủ; quân bộ xếp hàng ở chỗ qua.',
  'An inland sea with a bay at every base. Build a Naval Yard and fight for the water; armies march round the coast.':
    'Biển nội địa có vịnh ăn tới từng căn cứ. Xây Xưởng tàu và tranh quyền kiểm soát mặt nước; quân bộ đi vòng theo bờ biển.',
  'A strait splits north from south. Armies cross only at the two isthmuses; warships and landing craft rule the middle.':
    'Eo biển chia đôi bắc và nam. Quân bộ chỉ qua được ở hai eo đất hai đầu; chiến hạm và tàu đổ bộ làm chủ khoảng giữa.',
  'Factories, rail yards and a canal. Tight streets favour infantry and close-range armor.':
    'Nhà máy, bãi đường sắt và kênh đào. Đường hẹp có lợi cho bộ binh và xe tầm gần.',

  // ------------------------------------------------------------ campaign
  'Boot Camp': 'Trại huấn luyện',
  Tidewater: 'Thủy triều',
  // v0.17: missions 6 and 7
  'Iron Convoy': 'Đoàn xe thép',
  'Snowfield · night escort': 'Snowfield · hộ tống ban đêm',
  'A blizzard covers our advance. We have no base here: only a Mobile Command Vehicle and its escort. Bring the MCV to the Frozen Crossroads in the middle of the snowfield, deploy it into a forward base and hold it for five minutes while the Iron Guard counter-attacks. Expect an ambush on the way. Then crush them.':
    'Bão tuyết che cho cuộc tiến quân. Ở đây ta không có căn cứ: chỉ có một Xe chỉ huy cơ động (MCV) và đoàn hộ tống. Đưa MCV tới Ngã tư Băng giá giữa cánh đồng tuyết, triển khai thành căn cứ tiền tuyến và giữ nó trong năm phút khi Iron Guard phản công. Coi chừng phục kích trên đường. Sau đó hãy đè bẹp chúng.',
  'Escort the MCV to the Frozen Crossroads': 'Hộ tống MCV tới Ngã tư Băng giá',
  'Move the convoy together: tanks in front. The crossroads is the flag in the middle of the map.':
    'Di chuyển cả đoàn cùng nhau: xe tăng đi trước. Ngã tư là lá cờ ở giữa bản đồ.',
  'Deploy the forward base': 'Triển khai căn cứ tiền tuyến',
  'Select the MCV at the crossroads and press U (Deploy). It unfolds into a Headquarters.':
    'Chọn MCV ở ngã tư và nhấn U (Triển khai). Xe sẽ mở ra thành Sở chỉ huy.',
  'Hold the forward base for 5 minutes': 'Giữ căn cứ tiền tuyến trong 5 phút',
  'Build Power Plants, Barracks and turrets around the new Headquarters. If it falls, the clock restarts.':
    'Xây Nhà máy điện, Doanh trại và trụ phòng thủ quanh Sở chỉ huy mới. Nếu căn cứ bị phá, đồng hồ tính lại từ đầu.',
  'Destroy the Iron Guard': 'Tiêu diệt Iron Guard',
  'Annihilation: every enemy building and unit must fall. Tanks and artillery break their defenses.':
    'Tiêu diệt: mọi công trình và unit địch phải bị phá hủy. Xe tăng và pháo binh phá vỡ tuyến phòng thủ của chúng.',
  'Shadow Front': 'Mặt trận Bóng tối',
  'Forest Warfare · final battle, 2 vs 2': 'Forest Warfare · trận cuối, 2 đấu 2',
  'This is the last front. The Shadow Legion and the Black Sun have joined forces, and their commanders learn: they read how you fight and change their plans. Fight beside the Northern Wing, take every strategic point in the forest and destroy both enemy Headquarters. Vary your tactics — they will see a pattern.':
    'Đây là mặt trận cuối cùng. Shadow Legion và Black Sun đã liên minh, và các chỉ huy của chúng biết học hỏi: chúng đọc cách bạn đánh và đổi kế hoạch. Chiến đấu cùng Northern Wing, chiếm mọi điểm chiến lược trong rừng và phá hủy cả hai Sở chỉ huy địch. Hãy thay đổi chiến thuật — chúng sẽ nhận ra lối mòn.',
  'The forest points give income and vision. Your ally helps; hold them together.':
    'Các điểm trong rừng cho thu nhập và tầm nhìn. Đồng minh sẽ hỗ trợ; hãy cùng nhau giữ chúng.',
  'Strait Crossing · naval assault': 'Strait Crossing · tấn công đường biển',
  'The enemy holds the south shore of the strait and its fleet rules the water. The isthmuses are heavily watched, so this time we go by sea. Build a Naval Yard, win the strait, put troops ashore on the South Shore with Landing Craft and finish the enemy. Beware of submarines: only Patrol Boats can find them.':
    'Địch giữ bờ nam eo biển và hạm đội của chúng làm chủ mặt nước. Hai eo đất bị canh gác gắt, nên lần này ta đi đường biển. Xây Xưởng tàu, giành quyền kiểm soát eo biển, dùng Tàu đổ bộ đưa quân lên Bờ Nam rồi tiêu diệt địch. Cẩn thận tàu ngầm: chỉ Tàu tuần tra mới phát hiện được chúng.',
  'Build a Naval Yard': 'Xây Xưởng tàu',
  'Requires a War Factory. It must touch the water: build it on the shore of your bay.':
    'Cần Nhà máy chiến xa. Xưởng phải sát nước: xây trên bờ vịnh nhà.',
  'Sink 3 enemy ships': 'Đánh chìm 3 tàu địch',
  'Destroyers outgun Patrol Boats; Submarines sink Destroyers; Patrol Boats hunt Submarines.':
    'Khu trục áp đảo Tàu tuần tra; Tàu ngầm đánh chìm Khu trục; Tàu tuần tra săn Tàu ngầm.',
  'Capture the South Shore': 'Chiếm Bờ Nam',
  'Load infantry and tanks into a Landing Craft (right-click it), sail across and unload (U) at the beach.':
    'Cho bộ binh và xe tăng lên Tàu đổ bộ (chuột phải vào tàu), vượt eo biển và thả quân (U) ở bãi biển.',
  'Desert Storm · training': 'Desert Storm · huấn luyện',
  'Welcome to the front, Commander. Learn to move troops, build a base, train an army and take ground. An undefended enemy outpost sits in the far corner. Destroy it to finish your training.':
    'Chào mừng tới mặt trận, Chỉ huy. Hãy học cách điều quân, xây căn cứ, huấn luyện quân đội và chiếm đất. Một tiền đồn địch không phòng bị nằm ở góc xa. Phá hủy nó để hoàn thành khóa huấn luyện.',
  'Select your soldiers': 'Chọn binh lính',
  'Left-drag a box around your starting units (or press Q to select your whole army).':
    'Kéo chuột trái quanh các unit ban đầu (hoặc nhấn Q để chọn toàn quân).',
  'Move out': 'Xuất phát',
  'With units selected, right-click on open ground to move them there.': 'Khi đang chọn unit, chuột phải lên đất trống để đưa chúng tới đó.',
  'Build a Power Plant': 'Xây Nhà máy điện',
  'Click Power Plant in the Construction panel (bottom right), then click near your HQ. Every building needs power.':
    'Bấm Nhà máy điện trong bảng Xây dựng (góc dưới phải), rồi bấm gần Sở chỉ huy. Mọi công trình đều cần điện.',
  'Build a Resource Extractor': 'Xây Máy khai thác',
  'Place a Resource Extractor right next to the dark ore field near your base. It earns credits until the ore runs out.':
    'Đặt Máy khai thác sát mỏ quặng gần căn cứ. Nó kiếm tiền cho tới khi hết quặng.',
  'Build Barracks': 'Xây Doanh trại',
  'Barracks train infantry. Build one near your HQ.': 'Doanh trại huấn luyện bộ binh. Xây một cái gần Sở chỉ huy.',
  'Train 3 units': 'Huấn luyện 3 unit',
  'Select the Barracks and click Rifleman or AT Soldier three times. Right-click the map to set a rally point.':
    'Chọn Doanh trại và bấm Lính súng trường hoặc Lính chống tăng ba lần. Chuột phải lên bản đồ để đặt điểm tập kết.',
  'Capture a strategic point': 'Chiếm một điểm chiến lược',
  'Move ground units into a flag circle and keep them there. Each point gives +6 credits/s and vision.':
    'Đưa quân mặt đất vào vòng tròn có cờ và giữ ở đó. Mỗi điểm cho +6 tiền / giây và tầm nhìn.',
  'Destroy the enemy outpost': 'Phá hủy tiền đồn địch',
  'The outpost is in the far corner. Build a War Factory for tanks (strong against buildings), press Q, then right-click the enemy HQ.':
    'Tiền đồn ở góc xa. Xây Nhà máy chiến xa để có xe tăng (mạnh với công trình), nhấn Q, rồi chuột phải vào Sở chỉ huy địch.',
  'Hold the River': 'Giữ dòng sông',
  'River Crossing · defence': 'River Crossing · phòng thủ',
  'Hostile columns are converging on the valley and the bridges are the only fast way across the river. Fortify, take the Central Bridge and hold out until the attack breaks: six waves are expected.':
    'Các đoàn quân địch đang hội tụ về thung lũng và những cây cầu là đường nhanh duy nhất qua sông. Hãy gia cố, chiếm Cầu giữa và trụ vững cho tới khi cuộc tấn công tan rã: dự kiến có sáu đợt.',
  'Build a Defense Turret': 'Xây Tháp pháo phòng thủ',
  'Requires a Barracks. Place turrets toward the river crossings.': 'Cần Doanh trại. Đặt tháp pháo hướng về các chỗ qua sông.',
  'Capture the Central Bridge': 'Chiếm Cầu giữa',
  'Move ground units into the flag circle in the middle of the river.': 'Đưa quân mặt đất vào vòng cờ ở giữa sông.',
  'Repel all 6 waves': 'Đẩy lùi cả 6 đợt',
  'Waves are announced 20 s ahead. Press Space to look at the entry point.':
    'Mỗi đợt được báo trước 20 giây. Nhấn Space để xem nơi địch tiến vào.',
  'Iron Fist': 'Nắm đấm thép',
  'Urban Conflict · 2 vs 2 assault': 'Urban Conflict · tấn công 2 đấu 2',
  'Two enemy commanders hold the city. An allied AI commander fights at your side. Intelligence reports that the Desert Hawks rely on attack helicopters: tanks cannot shoot them down, so build SAM Sites and AT Soldiers. Upgrade your firepower and destroy both enemy Headquarters.':
    'Hai chỉ huy địch đang giữ thành phố. Một chỉ huy máy đồng minh chiến đấu cùng bạn. Tình báo cho biết Diều hâu Sa mạc dựa vào trực thăng tấn công: xe tăng không bắn hạ được chúng, hãy xây SAM và Lính chống tăng. Nâng cấp hỏa lực và phá hủy cả hai Sở chỉ huy địch.',
  'Build a War Factory': 'Xây Nhà máy chiến xa',
  'Tanks are strong against buildings. The War Factory requires Barracks.': 'Xe tăng mạnh với công trình. Nhà máy chiến xa cần Doanh trại.',
  'Build a SAM Site': 'Xây bệ SAM',
  'SAM Sites shoot down helicopters and drones. AT Soldiers can also hit aircraft.':
    'SAM bắn hạ trực thăng và drone. Lính chống tăng cũng bắn được máy bay.',
  'Research Improved Munitions': 'Nghiên cứu Đạn dược cải tiến',
  'Build a Research Center, select it and research Improved Munitions (+15% damage).':
    'Xây Trung tâm nghiên cứu, chọn nó và nghiên cứu Đạn dược cải tiến (+15% sát thương).',
  'Destroy both enemy Headquarters': 'Phá hủy cả hai Sở chỉ huy địch',
  'Decapitation: a commander is eliminated when its HQ falls.': 'Chặt đầu: chỉ huy bị loại khi Sở chỉ huy bị phá.',
  'Highland Siege': 'Vây hãm cao nguyên',
  'Highland Pass · 1 vs 1 territory': 'Highland Pass · tranh lãnh thổ 1 đấu 1',
  'A walled hill town controls the only rich ore in the highlands, and its four passes are the only way in. A seasoned enemy commander wants it too. Take the town, hold every strategic point at once, then crush the enemy.':
    'Một thị trấn có tường kiểm soát mỏ quặng giàu duy nhất trên cao nguyên, và bốn con đèo là lối vào duy nhất. Một chỉ huy địch dày dạn cũng muốn chiếm nó. Hãy chiếm thị trấn, giữ mọi điểm chiến lược cùng lúc, rồi đè bẹp kẻ địch.',
  'Capture the Town Square': 'Chiếm Quảng trường thị trấn',
  'Enter the plateau through a pass and hold the flag in the middle of the town.': 'Vào cao nguyên qua một con đèo và giữ cờ ở giữa thị trấn.',
  'Hold all 3 strategic points at once': 'Giữ cả 3 điểm chiến lược cùng lúc',
  'North Pass, Town Square and South Pass. Each point gives +6 credits/s.': 'Đèo Bắc, Quảng trường và Đèo Nam. Mỗi điểm cho +6 tiền / giây.',
  'Destroy all enemy forces': 'Tiêu diệt toàn bộ lực lượng địch',
  'Annihilation: every enemy building and unit must fall.': 'Tiêu diệt: mọi công trình và unit địch phải bị phá hủy.',

  // ------------------------------------------------------------ achievements, challenges, titles
  'First Blood': 'Giọt máu đầu',
  'Destroy your first enemy.': 'Tiêu diệt kẻ địch đầu tiên.',
  'First Victory': 'Chiến thắng đầu tiên',
  'Win a match.': 'Thắng một trận.',
  'Veteran Commander': 'Chỉ huy kỳ cựu',
  'Win 10 matches.': 'Thắng 10 trận.',
  'Hard Target': 'Mục tiêu khó',
  'Win against a Hard AI.': 'Thắng máy độ khó Khó.',
  'Beyond Insane': 'Vượt cực khó',
  'Win against an Insane AI.': 'Thắng máy độ khó Cực khó.',
  Blitzkrieg: 'Chiến tranh chớp nhoáng',
  'Win a skirmish in under 10 minutes.': 'Thắng một trận đấu trong dưới 10 phút.',
  'Last Stand': 'Trận chiến cuối cùng',
  'Survive 10 or more Survival waves.': 'Sống sót qua 10 đợt Sinh tồn trở lên.',
  Dominator: 'Kẻ thống trị',
  'Win a Domination match.': 'Thắng một trận Chiếm đóng.',
  Explorer: 'Nhà thám hiểm',
  'Win on a random map.': 'Thắng trên bản đồ ngẫu nhiên.',
  'Hero of the Front': 'Anh hùng mặt trận',
  'Promote a unit to Heroic rank.': 'Thăng một unit lên cấp Anh hùng.',
  Centurion: 'Bách phu trưởng',
  'Destroy 100 enemies in total.': 'Tiêu diệt tổng cộng 100 kẻ địch.',
  'Campaign Complete': 'Hoàn thành chiến dịch',
  'Complete every campaign mission.': 'Hoàn thành mọi nhiệm vụ chiến dịch.',
  'Master of Arms': 'Bậc thầy binh khí',
  'Win with all five factions.': 'Thắng với cả năm phe.',
  'Win a match': 'Thắng 1 trận',
  'Destroy 30 enemies': 'Tiêu diệt 30 địch',
  'Build 25 units': 'Sản xuất 25 unit',
  'Play 20 minutes': 'Chơi 20 phút',
  'Win a Domination or Capture the Flag match': 'Thắng 1 trận Chiếm đóng hoặc Cướp cờ',
  'Survive 5 Survival waves': 'Sống sót 5 đợt Sinh tồn',
  'Win 5 matches': 'Thắng 5 trận',
  'Destroy 300 enemies': 'Tiêu diệt 300 địch',
  'Beat a Hard or Insane AI': 'Thắng máy Khó hoặc Cực khó',
  'Play 2 hours': 'Chơi 2 giờ',
  'Win with 3 different factions': 'Thắng với 3 phe khác nhau',
  Recruit: 'Tân binh',
  Default: 'Mặc định',
  Lieutenant: 'Trung úy',
  'Reach level 5': 'Đạt cấp 5',
  Captain: 'Đại úy',
  'Reach level 10': 'Đạt cấp 10',
  Major: 'Thiếu tá',
  'Reach level 20': 'Đạt cấp 20',
  Colonel: 'Đại tá',
  'Reach level 35': 'Đạt cấp 35',
  General: 'Đại tướng',
  'Reach level 50': 'Đạt cấp 50',
  'Achievement: Hero of the Front': 'Thành tích: Anh hùng mặt trận',
  Survivor: 'Người sống sót',
  'Achievement: Last Stand': 'Thành tích: Trận chiến cuối cùng',
  Strategist: 'Nhà chiến lược',
  'Achievement: Campaign Complete': 'Thành tích: Hoàn thành chiến dịch',
  Warmaster: 'Chiến tướng',
  'Achievement: Master of Arms': 'Thành tích: Bậc thầy binh khí',
  Specialist: 'Chuyên gia',
  'Faction mastery 5': 'Thành thạo phe cấp 5',
  Grandmaster: 'Đại kiện tướng',
  'Faction mastery 10': 'Thành thạo phe cấp 10',
  'Weapons Expert': 'Chuyên gia vũ khí',
  'Unit mastery 5': 'Thành thạo unit cấp 5',
};
