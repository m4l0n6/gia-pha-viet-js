import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import connectDB from "@/lib/mongodb"
import FamilyTree from "@/models/FamilyTree"
import Member from "@/models/Member"
import Membership from "@/models/Membership"
import mongoose from "mongoose"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const familyTreeId = params.id

    // Kiểm tra quyền truy cập
    const membership = await Membership.findOne({
      userId: new mongoose.Types.ObjectId(session.user.id),
      familyTreeId: new mongoose.Types.ObjectId(familyTreeId),
    })

    const isCreator = await FamilyTree.findOne({
      _id: new mongoose.Types.ObjectId(familyTreeId),
      creatorId: new mongoose.Types.ObjectId(session.user.id),
    })

    if (!membership && !isCreator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Lấy tất cả thành viên trong gia phả
    const members = await Member.find({
      familyTreeId: new mongoose.Types.ObjectId(familyTreeId),
    }).lean()

    return NextResponse.json(members)
  } catch (error) {
    console.error("Error fetching members:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const familyTreeId = params.id
    const data = await req.json()

    console.log("Received data:", data)

    // Kiểm tra quyền truy cập
    const membership = await Membership.findOne({
      userId: new mongoose.Types.ObjectId(session.user.id),
      familyTreeId: new mongoose.Types.ObjectId(familyTreeId),
    })

    const isCreator = await FamilyTree.findOne({
      _id: new mongoose.Types.ObjectId(familyTreeId),
      creatorId: new mongoose.Types.ObjectId(session.user.id),
    })

    if (!membership && !isCreator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Chuẩn bị dữ liệu thành viên
    const memberData = {
      fullName: data.fullName,
      gender: data.gender,
      birthYear: data.birthYear || null,
      birthDate: data.birthDate || null,
      birthDateLunar: data.birthDateLunar || null,
      birthPlace: data.birthPlace || null,
      deathYear: data.deathYear || null,
      deathDate: data.deathDate || null,
      deathDateLunar: data.deathDateLunar || null,
      deathPlace: data.deathPlace || null,
      biography: data.biography || null,
      image: data.image || null,
      familyTreeId: new mongoose.Types.ObjectId(familyTreeId),
      isAlive: data.isAlive,
      generation: data.generation,
      role: data.role || null,
      occupation: data.occupation || null,
      notes: data.notes || null,
      hometown: data.hometown,
      ethnicity: data.ethnicity,
      nationality: data.nationality,
      religion: data.religion || null,
      title: data.title || null,
      createdById: new mongoose.Types.ObjectId(session.user.id),
      updatedById: new mongoose.Types.ObjectId(session.user.id),
    }

    // Xử lý các trường quan hệ
    if (data.fatherId && data.fatherId !== "none") {
      try {
        memberData.fatherId = new mongoose.Types.ObjectId(data.fatherId)
      } catch (error) {
        console.error("Invalid fatherId:", data.fatherId, error)
        memberData.fatherId = null
      }
    } else {
      memberData.fatherId = null
    }

    if (data.motherId && data.motherId !== "none") {
      try {
        memberData.motherId = new mongoose.Types.ObjectId(data.motherId)
      } catch (error) {
        console.error("Invalid motherId:", data.motherId, error)
        memberData.motherId = null
      }
    } else {
      memberData.motherId = null
    }

    if (data.spouseId && data.spouseId !== "none") {
      try {
        memberData.spouseId = new mongoose.Types.ObjectId(data.spouseId)
      } catch (error) {
        console.error("Invalid spouseId:", data.spouseId, error)
        memberData.spouseId = null
      }
    } else {
      memberData.spouseId = null
    }

    console.log("Processed member data:", memberData)

    // Tạo thành viên mới
    const newMember = new Member(memberData)
    await newMember.save()

    // Cập nhật mối quan hệ hai chiều
    if (memberData.spouseId) {
      await Member.findByIdAndUpdate(memberData.spouseId, {
        spouseId: newMember._id,
      })
    }

    // Cập nhật danh sách con cho cha/mẹ
    if (memberData.fatherId) {
      await Member.findByIdAndUpdate(memberData.fatherId, {
        $addToSet: { childrenIds: newMember._id },
      })
    }

    if (memberData.motherId) {
      await Member.findByIdAndUpdate(memberData.motherId, {
        $addToSet: { childrenIds: newMember._id },
      })
    }

    return NextResponse.json(newMember)
  } catch (error) {
    console.error("Error creating member:", error)
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
  }
}
